// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ProfileRegistryV2
 * @dev Upgradeable profile registry with guardian-based recovery.
 *      Implements UUPS pattern for upgradeability.
 *      Progressive decentralization: auto-requires multisig after 500 users.
 */
contract ProfileRegistryV2 is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    // ============================================================
    // Constants
    // ============================================================

    uint256 public constant DECENTRALIZATION_THRESHOLD = 500;
    uint256 public constant MIN_GUARDIANS = 3;
    uint256 public constant MAX_GUARDIANS = 5;
    uint256 public constant MIN_TIME_LOCK_HOURS = 24;

    // ============================================================
    // State Variables
    // ============================================================

    // Profile mapping: user address -> IPFS CID
    mapping(address => string) public profiles;
    mapping(address => uint256) public lastUpdated;

    // Governance
    uint256 public totalUsers;
    address public multisig;
    bool public multisigRequired;

    // Recovery configuration per user
    struct RecoveryConfig {
        uint256 timeLockHours;
        uint256 threshold;
        string[] shareCids;
        bytes32 verificationHash;
        bool configured;
    }
    mapping(address => RecoveryConfig) public recoveryConfigs;

    // Guardians per user
    mapping(address => address[]) public guardians;
    mapping(address => mapping(address => bool)) public isGuardian;

    // Pending recovery requests
    struct RecoveryRequest {
        address initiator;
        uint256 initiatedAt;
        uint256 votesReceived;
        bool cancelled;
        bool completed;
        mapping(address => bool) hasVoted;
    }
    mapping(address => RecoveryRequest) internal _pendingRecoveries;

    // ============================================================
    // Events
    // ============================================================

    event ProfileUpdated(address indexed user, string cid, uint256 timestamp);
    event UserRegistered(address indexed user, uint256 totalUsers);
    event MultisigActivated(uint256 userCount);
    event MultisigUpdated(address indexed oldMultisig, address indexed newMultisig);

    event GuardianAdded(address indexed user, address indexed guardian);
    event GuardianRemoved(address indexed user, address indexed guardian);
    event RecoveryConfigured(address indexed user, uint256 guardianCount, uint256 threshold);

    event RecoveryInitiated(address indexed user, address indexed initiator, uint256 completesAt);
    event RecoveryVoteSubmitted(address indexed user, address indexed guardian, uint256 totalVotes);
    event RecoveryCancelled(address indexed user);
    event RecoveryCompleted(address indexed user, string newCid);

    // ============================================================
    // Errors
    // ============================================================

    error NotAGuardian();
    error RecoveryAlreadyPending();
    error NoRecoveryPending();
    error TimeLockNotExpired();
    error InsufficientVotes();
    error AlreadyVoted();
    error InvalidGuardianCount();
    error InvalidThreshold();
    error InvalidTimeLock();
    error MultisigRequiredForAction();
    error InvalidMultisig();
    error RecoveryNotConfigured();

    // ============================================================
    // Initialization
    // ============================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract.
     * @param _multisig Address of the multisig for governance after threshold.
     */
    function initialize(address _multisig) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();

        if (_multisig == address(0)) revert InvalidMultisig();
        multisig = _multisig;
        multisigRequired = false;
    }

    // ============================================================
    // Profile Management
    // ============================================================

    /**
     * @dev Updates the profile CID for the caller.
     * @param cid The new IPFS Content Identifier.
     */
    function updateProfile(string calldata cid) external whenNotPaused {
        bool isNewUser = bytes(profiles[msg.sender]).length == 0;

        profiles[msg.sender] = cid;
        lastUpdated[msg.sender] = block.timestamp;

        if (isNewUser) {
            totalUsers++;
            emit UserRegistered(msg.sender, totalUsers);

            // Check if we hit decentralization threshold
            if (totalUsers >= DECENTRALIZATION_THRESHOLD && !multisigRequired) {
                multisigRequired = true;
                emit MultisigActivated(totalUsers);
            }
        }

        emit ProfileUpdated(msg.sender, cid, block.timestamp);
    }

    /**
     * @dev Returns the CID for a given user address.
     * @param user The address to look up.
     */
    function getProfile(address user) external view returns (string memory) {
        return profiles[user];
    }

    // ============================================================
    // Guardian Management
    // ============================================================

    /**
     * @dev Configures recovery for the caller.
     * @param _guardians Array of guardian addresses (3-5).
     * @param _threshold Number of votes required for recovery.
     * @param _timeLockHours Hours to wait before recovery completes (min 24).
     * @param _shareCids IPFS CIDs of encrypted share data for each guardian.
     * @param _verificationHash Hash to verify reconstructed key.
     */
    function configureRecovery(
        address[] calldata _guardians,
        uint256 _threshold,
        uint256 _timeLockHours,
        string[] calldata _shareCids,
        bytes32 _verificationHash
    ) external whenNotPaused {
        if (_guardians.length < MIN_GUARDIANS || _guardians.length > MAX_GUARDIANS) {
            revert InvalidGuardianCount();
        }
        if (_threshold < 2 || _threshold > _guardians.length) {
            revert InvalidThreshold();
        }
        if (_timeLockHours < MIN_TIME_LOCK_HOURS) {
            revert InvalidTimeLock();
        }
        if (_shareCids.length != _guardians.length) {
            revert InvalidGuardianCount();
        }

        // Remove old guardians
        address[] storage oldGuardians = guardians[msg.sender];
        for (uint256 i = 0; i < oldGuardians.length; i++) {
            isGuardian[msg.sender][oldGuardians[i]] = false;
        }
        delete guardians[msg.sender];

        // Add new guardians
        for (uint256 i = 0; i < _guardians.length; i++) {
            guardians[msg.sender].push(_guardians[i]);
            isGuardian[msg.sender][_guardians[i]] = true;
            emit GuardianAdded(msg.sender, _guardians[i]);
        }

        // Store config
        recoveryConfigs[msg.sender] = RecoveryConfig({
            timeLockHours: _timeLockHours,
            threshold: _threshold,
            shareCids: _shareCids,
            verificationHash: _verificationHash,
            configured: true
        });

        emit RecoveryConfigured(msg.sender, _guardians.length, _threshold);
    }

    /**
     * @dev Returns guardian addresses for a user.
     */
    function getGuardians(address user) external view returns (address[] memory) {
        return guardians[user];
    }

    /**
     * @dev Returns recovery configuration for a user.
     */
    function getRecoveryConfig(address user) external view returns (
        uint256 timeLockHours,
        uint256 threshold,
        string[] memory shareCids,
        bytes32 verificationHash,
        bool configured
    ) {
        RecoveryConfig storage config = recoveryConfigs[user];
        return (
            config.timeLockHours,
            config.threshold,
            config.shareCids,
            config.verificationHash,
            config.configured
        );
    }

    // ============================================================
    // Recovery Process
    // ============================================================

    /**
     * @dev Initiates a recovery request. Only guardians can call.
     * @param user The account to recover.
     */
    function initiateRecovery(address user) external whenNotPaused {
        if (!isGuardian[user][msg.sender]) revert NotAGuardian();
        if (!recoveryConfigs[user].configured) revert RecoveryNotConfigured();

        RecoveryRequest storage request = _pendingRecoveries[user];
        if (request.initiatedAt > 0 && !request.cancelled && !request.completed) {
            revert RecoveryAlreadyPending();
        }

        // Reset request
        request.initiator = msg.sender;
        request.initiatedAt = block.timestamp;
        request.votesReceived = 1;
        request.cancelled = false;
        request.completed = false;
        request.hasVoted[msg.sender] = true;

        uint256 completesAt = block.timestamp + (recoveryConfigs[user].timeLockHours * 1 hours);
        emit RecoveryInitiated(user, msg.sender, completesAt);
        emit RecoveryVoteSubmitted(user, msg.sender, 1);
    }

    /**
     * @dev Submits a vote for an existing recovery request.
     * @param user The account being recovered.
     */
    function voteForRecovery(address user) external whenNotPaused {
        if (!isGuardian[user][msg.sender]) revert NotAGuardian();

        RecoveryRequest storage request = _pendingRecoveries[user];
        if (request.initiatedAt == 0 || request.cancelled || request.completed) {
            revert NoRecoveryPending();
        }
        if (request.hasVoted[msg.sender]) revert AlreadyVoted();

        request.hasVoted[msg.sender] = true;
        request.votesReceived++;

        emit RecoveryVoteSubmitted(user, msg.sender, request.votesReceived);
    }

    /**
     * @dev Cancels a pending recovery. Only the account owner can call.
     */
    function cancelRecovery() external {
        RecoveryRequest storage request = _pendingRecoveries[msg.sender];
        if (request.initiatedAt == 0 || request.cancelled || request.completed) {
            revert NoRecoveryPending();
        }

        request.cancelled = true;
        emit RecoveryCancelled(msg.sender);
    }

    /**
     * @dev Completes the recovery and updates the profile.
     *      Can only be called after time lock expires and threshold is met.
     * @param user The account being recovered.
     * @param newCid The new profile CID after recovery.
     */
    function completeRecovery(address user, string calldata newCid) external whenNotPaused {
        if (!isGuardian[user][msg.sender]) revert NotAGuardian();

        RecoveryRequest storage request = _pendingRecoveries[user];
        if (request.initiatedAt == 0 || request.cancelled || request.completed) {
            revert NoRecoveryPending();
        }

        RecoveryConfig storage config = recoveryConfigs[user];
        uint256 timeLockEnd = request.initiatedAt + (config.timeLockHours * 1 hours);

        if (block.timestamp < timeLockEnd) revert TimeLockNotExpired();
        if (request.votesReceived < config.threshold) revert InsufficientVotes();

        // Update profile
        profiles[user] = newCid;
        lastUpdated[user] = block.timestamp;
        request.completed = true;

        emit RecoveryCompleted(user, newCid);
        emit ProfileUpdated(user, newCid, block.timestamp);
    }

    /**
     * @dev Returns pending recovery status for a user.
     */
    function getPendingRecovery(address user) external view returns (
        address initiator,
        uint256 initiatedAt,
        uint256 votesReceived,
        bool cancelled,
        bool completed,
        uint256 timeLockEnd
    ) {
        RecoveryRequest storage request = _pendingRecoveries[user];
        RecoveryConfig storage config = recoveryConfigs[user];

        uint256 _timeLockEnd = 0;
        if (request.initiatedAt > 0) {
            _timeLockEnd = request.initiatedAt + (config.timeLockHours * 1 hours);
        }

        return (
            request.initiator,
            request.initiatedAt,
            request.votesReceived,
            request.cancelled,
            request.completed,
            _timeLockEnd
        );
    }

    // ============================================================
    // Governance
    // ============================================================

    /**
     * @dev Modifier to check governance requirements.
     */
    modifier onlyGovernance() {
        if (multisigRequired) {
            if (msg.sender != multisig) revert MultisigRequiredForAction();
        } else {
            _checkOwner();
        }
        _;
    }

    /**
     * @dev Pauses the contract. Only governance can call.
     */
    function pause() external onlyGovernance {
        _pause();
    }

    /**
     * @dev Unpauses the contract. Only governance can call.
     */
    function unpause() external onlyGovernance {
        _unpause();
    }

    /**
     * @dev Updates the multisig address. Only governance can call.
     * @param _newMultisig The new multisig address.
     */
    function setMultisig(address _newMultisig) external onlyGovernance {
        if (_newMultisig == address(0)) revert InvalidMultisig();
        address oldMultisig = multisig;
        multisig = _newMultisig;
        emit MultisigUpdated(oldMultisig, _newMultisig);
    }

    // ============================================================
    // View Functions
    // ============================================================

    /**
     * @dev Returns whether multisig governance is active.
     */
    function isDecentralized() external view returns (bool) {
        return multisigRequired;
    }

    /**
     * @dev Returns users remaining until decentralization.
     */
    function usersUntilDecentralization() external view returns (uint256) {
        if (totalUsers >= DECENTRALIZATION_THRESHOLD) return 0;
        return DECENTRALIZATION_THRESHOLD - totalUsers;
    }

    // ============================================================
    // UUPS Upgrade Authorization
    // ============================================================

    /**
     * @dev Authorizes an upgrade. Only governance can call.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyGovernance {
        // Additional validation could be added here
    }

    /**
     * @dev Returns the contract version.
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
