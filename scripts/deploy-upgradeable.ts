/**
 * Deploy Upgradeable ProfileRegistry
 *
 * Deploys the ProfileRegistryV2 contract using UUPS proxy pattern.
 * Run with: npx hardhat run scripts/deploy-upgradeable.ts --network <network>
 */

import hre from "hardhat";
const { ethers, upgrades } = hre;

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("Deploying ProfileRegistryV2 (Upgradeable)");
    console.log("=".repeat(60));
    console.log();
    console.log("Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    console.log();

    // Get multisig address from environment or use deployer for testing
    const multisigAddress = process.env.MULTISIG_ADDRESS || deployer.address;
    console.log("Multisig:", multisigAddress);

    if (multisigAddress === deployer.address) {
        console.log("⚠️  WARNING: Using deployer as multisig (testing mode)");
    }
    console.log();

    // Deploy proxy with implementation
    console.log("Deploying proxy and implementation...");
    const ProfileRegistry = await ethers.getContractFactory("ProfileRegistryV2");

    const proxy = await upgrades.deployProxy(
        ProfileRegistry,
        [multisigAddress],
        {
            kind: "uups",
            initializer: "initialize"
        }
    );

    await proxy.waitForDeployment();

    const proxyAddress = await proxy.getAddress();
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

    console.log();
    console.log("✅ Deployment Successful!");
    console.log("-".repeat(60));
    console.log("Proxy Address:          ", proxyAddress);
    console.log("Implementation Address: ", implementationAddress);
    console.log("Admin Address:          ", adminAddress);
    console.log();

    // Verify initial state
    const version = await proxy.version();
    const owner = await proxy.owner();
    const multisig = await proxy.multisig();
    const threshold = await proxy.DECENTRALIZATION_THRESHOLD();
    const isDecentralized = await proxy.isDecentralized();

    console.log("Contract State:");
    console.log("-".repeat(60));
    console.log("Version:                ", version);
    console.log("Owner:                  ", owner);
    console.log("Multisig:               ", multisig);
    console.log("Decentralization At:    ", threshold.toString(), "users");
    console.log("Is Decentralized:       ", isDecentralized);
    console.log();

    // Save deployment info
    const deploymentInfo = {
        network: process.env.HARDHAT_NETWORK || "localhost",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        proxy: proxyAddress,
        implementation: implementationAddress,
        admin: adminAddress,
        multisig: multisigAddress,
        version
    };

    console.log("Deployment Info (save this):");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log();
    console.log("=".repeat(60));
    console.log("Next steps:");
    console.log("1. Verify contract on block explorer");
    console.log("2. Update frontend with proxy address");
    console.log("3. Set up multisig if not already done");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
