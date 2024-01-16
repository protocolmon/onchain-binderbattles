import { expect } from "chai";

describe("Binder", function () {
    it("prepareBinderNftTransfer - revert if the caller is not the BinderNft contract", async function () {
        const [admin, user1] = await ethers.getSigners();

        const binder = await ethers.deployContract("Binder");
        const binderNft = await ethers.deployContract("BinderNft", ["Binder", "Binder", binder.address]);
        const requirementChecker = await ethers.deployContract("RequirementChecker", [admin.address]);
        await binder.initialize(
            admin.address,
            binderNft.address,
            requirementChecker.address,
            [{ requirements: [] }]
        );
        await binderNft.connect(user1).createBinderNft();

        await expect(
            binder.connect(user1).prepareBinderNftTransfer(user1.address, admin.address, 0)
        ).to.be.reverted;
    });
});
