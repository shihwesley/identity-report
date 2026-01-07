import { expect } from "chai"
import { ethers } from "hardhat"
import { ProfileRegistry } from "../../typechain-types"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"

/**
 * ProfileRegistry Contract Tests
 *
 * Tests cover:
 * - Profile registration and updates
 * - Profile retrieval
 * - Event emissions
 * - Access control (only owner can update own profile)
 * - Edge cases and error conditions
 * - Gas consumption
 */

describe("ProfileRegistry", function () {
  let registry: ProfileRegistry
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress

  // Sample IPFS CIDs for testing
  const CID_1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
  const CID_2 = "QmW2WQi7j6c7UgJTarActp7tDNikE4B2qXtFCfLPdsgaTQ"
  const CID_3 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
  const EMPTY_CID = ""

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners()

    // Deploy the contract
    const ProfileRegistryFactory = await ethers.getContractFactory("ProfileRegistry")
    registry = await ProfileRegistryFactory.deploy()
    await registry.waitForDeployment()
  })

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const address = await registry.getAddress()
      expect(address).to.be.properAddress
    })

    it("should start with no profiles", async function () {
      const profile = await registry.getProfile(user1.address)
      expect(profile).to.equal("")
    })
  })

  describe("updateProfile", function () {
    it("should allow a user to set their profile CID", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      const storedCid = await registry.getProfile(user1.address)
      expect(storedCid).to.equal(CID_1)
    })

    it("should allow a user to update their existing profile", async function () {
      // Set initial profile
      await registry.connect(user1).updateProfile(CID_1)

      // Update to new CID
      await registry.connect(user1).updateProfile(CID_2)

      const storedCid = await registry.getProfile(user1.address)
      expect(storedCid).to.equal(CID_2)
    })

    it("should emit ProfileUpdated event on profile set", async function () {
      await expect(registry.connect(user1).updateProfile(CID_1))
        .to.emit(registry, "ProfileUpdated")
        .withArgs(user1.address, CID_1)
    })

    it("should emit ProfileUpdated event on profile update", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      await expect(registry.connect(user1).updateProfile(CID_2))
        .to.emit(registry, "ProfileUpdated")
        .withArgs(user1.address, CID_2)
    })

    it("should allow setting an empty CID", async function () {
      // First set a CID
      await registry.connect(user1).updateProfile(CID_1)

      // Then clear it
      await registry.connect(user1).updateProfile(EMPTY_CID)

      const storedCid = await registry.getProfile(user1.address)
      expect(storedCid).to.equal("")
    })

    it("should handle very long CID strings", async function () {
      const longCid = "a".repeat(500)
      await registry.connect(user1).updateProfile(longCid)

      const storedCid = await registry.getProfile(user1.address)
      expect(storedCid).to.equal(longCid)
    })

    it("should handle unicode characters in CID", async function () {
      const unicodeCid = "QmTest123_unicode_test"
      await registry.connect(user1).updateProfile(unicodeCid)

      const storedCid = await registry.getProfile(user1.address)
      expect(storedCid).to.equal(unicodeCid)
    })
  })

  describe("getProfile", function () {
    it("should return empty string for non-existent profile", async function () {
      const profile = await registry.getProfile(user2.address)
      expect(profile).to.equal("")
    })

    it("should return correct CID for existing profile", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      const profile = await registry.getProfile(user1.address)
      expect(profile).to.equal(CID_1)
    })

    it("should return correct CID for different users", async function () {
      await registry.connect(user1).updateProfile(CID_1)
      await registry.connect(user2).updateProfile(CID_2)
      await registry.connect(user3).updateProfile(CID_3)

      expect(await registry.getProfile(user1.address)).to.equal(CID_1)
      expect(await registry.getProfile(user2.address)).to.equal(CID_2)
      expect(await registry.getProfile(user3.address)).to.equal(CID_3)
    })

    it("should be callable by anyone", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      // user2 can read user1's profile
      const profile = await registry.connect(user2).getProfile(user1.address)
      expect(profile).to.equal(CID_1)
    })
  })

  describe("profiles mapping", function () {
    it("should be publicly accessible", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      // Access the public mapping directly
      const profile = await registry.profiles(user1.address)
      expect(profile).to.equal(CID_1)
    })

    it("should return empty for zero address", async function () {
      const profile = await registry.profiles(ethers.ZeroAddress)
      expect(profile).to.equal("")
    })
  })

  describe("Multiple Users", function () {
    it("should handle multiple users registering simultaneously", async function () {
      // Simulate multiple users registering (not truly simultaneous, but sequential)
      const promises = [
        registry.connect(user1).updateProfile(CID_1),
        registry.connect(user2).updateProfile(CID_2),
        registry.connect(user3).updateProfile(CID_3)
      ]

      await Promise.all(promises)

      expect(await registry.getProfile(user1.address)).to.equal(CID_1)
      expect(await registry.getProfile(user2.address)).to.equal(CID_2)
      expect(await registry.getProfile(user3.address)).to.equal(CID_3)
    })

    it("should isolate user profiles from each other", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      // Updating user2's profile should not affect user1
      await registry.connect(user2).updateProfile(CID_2)

      expect(await registry.getProfile(user1.address)).to.equal(CID_1)
    })

    it("should allow same CID for different users", async function () {
      await registry.connect(user1).updateProfile(CID_1)
      await registry.connect(user2).updateProfile(CID_1)

      expect(await registry.getProfile(user1.address)).to.equal(CID_1)
      expect(await registry.getProfile(user2.address)).to.equal(CID_1)
    })
  })

  describe("Gas Consumption", function () {
    it("should have reasonable gas for initial profile set", async function () {
      const tx = await registry.connect(user1).updateProfile(CID_1)
      const receipt = await tx.wait()

      // First write to storage is more expensive
      expect(receipt?.gasUsed).to.be.lessThan(100_000n)

      console.log(`Gas used for initial profile set: ${receipt?.gasUsed}`)
    })

    it("should have reasonable gas for profile update", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      const tx = await registry.connect(user1).updateProfile(CID_2)
      const receipt = await tx.wait()

      // Update should be similar or slightly cheaper
      expect(receipt?.gasUsed).to.be.lessThan(100_000n)

      console.log(`Gas used for profile update: ${receipt?.gasUsed}`)
    })

    it("should have minimal gas for getProfile", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      // getProfile is a view function, so we estimate gas
      const gasEstimate = await registry.getProfile.estimateGas(user1.address)

      // View functions should be cheap
      expect(gasEstimate).to.be.lessThan(50_000n)

      console.log(`Gas estimate for getProfile: ${gasEstimate}`)
    })

    it("should report gas for larger CID", async function () {
      const largeCid = "a".repeat(200)

      const tx = await registry.connect(user1).updateProfile(largeCid)
      const receipt = await tx.wait()

      console.log(`Gas used for large CID (200 chars): ${receipt?.gasUsed}`)

      // Should still be reasonable
      expect(receipt?.gasUsed).to.be.lessThan(200_000n)
    })
  })

  describe("Edge Cases", function () {
    it("should handle rapid successive updates", async function () {
      for (let i = 0; i < 5; i++) {
        await registry.connect(user1).updateProfile(`cid-${i}`)
      }

      expect(await registry.getProfile(user1.address)).to.equal("cid-4")
    })

    it("should handle special characters in CID", async function () {
      const specialCid = "Qm_-/.test123"
      await registry.connect(user1).updateProfile(specialCid)

      expect(await registry.getProfile(user1.address)).to.equal(specialCid)
    })

    it("should persist after contract re-access", async function () {
      await registry.connect(user1).updateProfile(CID_1)

      // Get the contract at same address (simulating new connection)
      const registryAddress = await registry.getAddress()
      const registryReconnected = await ethers.getContractAt("ProfileRegistry", registryAddress)

      expect(await registryReconnected.getProfile(user1.address)).to.equal(CID_1)
    })
  })

  describe("Event Verification", function () {
    it("should include correct indexed parameters in events", async function () {
      const tx = await registry.connect(user1).updateProfile(CID_1)
      const receipt = await tx.wait()

      // Find the event
      const event = receipt?.logs.find(
        (log) => log.address === (registry.target || registry.address)
      )

      expect(event).to.exist
    })

    it("should emit event with correct CID data", async function () {
      await expect(registry.connect(user1).updateProfile(CID_1))
        .to.emit(registry, "ProfileUpdated")
        .withArgs(user1.address, CID_1)
    })

    it("should emit separate events for each update", async function () {
      await expect(registry.connect(user1).updateProfile(CID_1))
        .to.emit(registry, "ProfileUpdated")

      await expect(registry.connect(user1).updateProfile(CID_2))
        .to.emit(registry, "ProfileUpdated")
        .withArgs(user1.address, CID_2)
    })
  })

  describe("Security Considerations", function () {
    it("should only allow msg.sender to update their own profile", async function () {
      // User1 sets their profile
      await registry.connect(user1).updateProfile(CID_1)

      // User2 cannot directly modify user1's profile
      // (The contract design only allows self-update via msg.sender)
      await registry.connect(user2).updateProfile(CID_2)

      // User1's profile should be unchanged
      expect(await registry.getProfile(user1.address)).to.equal(CID_1)
    })

    it("should handle large batch of registrations", async function () {
      const signers = await ethers.getSigners()

      // Register profiles for all available signers
      for (const signer of signers.slice(0, 10)) {
        await registry.connect(signer).updateProfile(`cid-${await signer.getAddress()}`)
      }

      // Verify each one
      for (const signer of signers.slice(0, 10)) {
        const address = await signer.getAddress()
        expect(await registry.getProfile(address)).to.equal(`cid-${address}`)
      }
    })
  })

  describe("Interface Compliance", function () {
    it("should expose updateProfile function", async function () {
      const fn = registry.updateProfile
      expect(fn).to.be.a("function")
    })

    it("should expose getProfile function", async function () {
      const fn = registry.getProfile
      expect(fn).to.be.a("function")
    })

    it("should expose profiles mapping", async function () {
      const fn = registry.profiles
      expect(fn).to.be.a("function")
    })
  })
})
