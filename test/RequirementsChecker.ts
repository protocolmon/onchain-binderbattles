import { expect } from "chai";

describe("RequirementsChecker", function () {
    it("whitelistNftContract - revert if the caller does not have the governance role", async function () {
        const [admin, user1] = await ethers.getSigners();

        const requirementChecker = await ethers.deployContract("RequirementChecker", [admin.address]);
        const polymonNfts = await ethers.deployContract("MockERC721");

        await expect(
            requirementChecker.connect(user1).whitelistNftContract(polymonNfts.address)
        ).to.be.reverted;
    });
});
