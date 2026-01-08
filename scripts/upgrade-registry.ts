/**
 * Upgrade ProfileRegistry
 *
 * Upgrades the ProfileRegistry contract to a new implementation.
 * Run with: npx hardhat run scripts/upgrade-registry.ts --network <network>
 */

import hre from "hardhat";
const { ethers, upgrades } = hre;

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("Upgrading ProfileRegistry");
    console.log("=".repeat(60));
    console.log();

    // Get proxy address from environment
    const proxyAddress = process.env.PROXY_ADDRESS;
    if (!proxyAddress) {
        throw new Error("PROXY_ADDRESS environment variable required");
    }

    console.log("Proxy Address:", proxyAddress);
    console.log("Upgrader:", deployer.address);
    console.log();

    // Get current contract state
    const currentContract = await ethers.getContractAt("ProfileRegistryV2", proxyAddress);

    const currentVersion = await currentContract.version();
    const isDecentralized = await currentContract.isDecentralized();
    const multisig = await currentContract.multisig();
    const totalUsers = await currentContract.totalUsers();

    console.log("Current State:");
    console.log("-".repeat(60));
    console.log("Version:", currentVersion);
    console.log("Total Users:", totalUsers.toString());
    console.log("Is Decentralized:", isDecentralized);
    console.log("Multisig:", multisig);
    console.log();

    // Check governance requirements
    if (isDecentralized) {
        console.log("⚠️  Contract is decentralized!");
        console.log("Upgrade must come from multisig:", multisig);

        if (deployer.address.toLowerCase() !== multisig.toLowerCase()) {
            console.log();
            console.log("To upgrade, create a multisig proposal with:");
            console.log(`- Target: ${proxyAddress}`);
            console.log("- Function: upgradeTo(address)");
            console.log("- Deploy new implementation first, then pass its address");
            console.log();
            throw new Error("Multisig required for upgrade");
        }
    }

    // Deploy new implementation and upgrade
    console.log("Deploying new implementation...");

    // Replace "ProfileRegistryV3" with the new contract name when upgrading
    const NewImplementation = await ethers.getContractFactory("ProfileRegistryV2");

    const upgraded = await upgrades.upgradeProxy(proxyAddress, NewImplementation);
    await upgraded.waitForDeployment();

    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    const newVersion = await upgraded.version();

    console.log();
    console.log("✅ Upgrade Successful!");
    console.log("-".repeat(60));
    console.log("New Implementation:", newImplementationAddress);
    console.log("New Version:", newVersion);
    console.log();

    // Verify state preserved
    const newTotalUsers = await upgraded.totalUsers();
    const newIsDecentralized = await upgraded.isDecentralized();

    console.log("State Verification:");
    console.log("-".repeat(60));
    console.log("Total Users (preserved):", newTotalUsers.toString());
    console.log("Is Decentralized:", newIsDecentralized);

    if (newTotalUsers.toString() !== totalUsers.toString()) {
        console.log("⚠️  WARNING: User count mismatch!");
    }

    console.log();
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Upgrade failed:", error);
        process.exit(1);
    });
