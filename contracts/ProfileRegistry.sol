// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ProfileRegistry
 * @dev A simple registry to map an Ethereum Address (DID) to an IPFS CID.
 *      This acts as the "Public Pointer" for the Profile Vault system.
 */
contract ProfileRegistry {
    // Mapping from User Address -> IPFS CID
    mapping(address => string) public profiles;

    // Event emitted when a profile is updated
    event ProfileUpdated(address indexed user, string cid);

    /**
     * @dev Updates the profile CID for the caller.
     * @param cid The new IPFS Content Identifier (e.g., "bafk...").
     */
    function updateProfile(string calldata cid) external {
        profiles[msg.sender] = cid;
        emit ProfileUpdated(msg.sender, cid);
    }

    /**
     * @dev Returns the CID for a given user address.
     * @param user The address to look up.
     */
    function getProfile(address user) external view returns (string memory) {
        return profiles[user];
    }
}
