import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Binder,
  BinderNft,
  MockERC721,
  MockPmon,
  PmonStore,
  RequirementChecker,
  TopLevelBinder,
} from "../typechain-types";

describe("TopLevelBinder", function () {
  let admin: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress;
  let pmon: MockPmon;
  let pmonStore: PmonStore;
  let polymonNfts: MockERC721;
  let topLevelBinder: TopLevelBinder;
  let requirementChecker: RequirementChecker;
  let binder1: Binder, binder2: Binder;
  let binderNft1: BinderNft, binderNft2: BinderNft;

  beforeEach(async function () {
    [admin, user1, user2, user3] = await ethers.getSigners();

    pmon = await ethers.deployContract("MockPmon");

    polymonNfts = await ethers.deployContract("MockERC721");

    topLevelBinder = await ethers.deployContract("TopLevelBinder");
    await topLevelBinder.initialize(admin.address, pmon.address);

    pmonStore = await ethers.deployContract("PmonStore", [
      topLevelBinder.address,
      pmon.address,
    ]);

    requirementChecker = await ethers.deployContract("RequirementChecker", [
      admin.address,
    ]);
    await requirementChecker.whitelistNftContract(polymonNfts.address);

    binder1 = await ethers.deployContract("Binder");
    binderNft1 = await ethers.deployContract("BinderNft", [
      "Binder1",
      "Binder1",
      binder1.address,
    ]);
    await binder1.initialize(
      admin.address,
      binderNft1.address,
      requirementChecker.address,
      [{ requirements: [] }, { requirements: [] }, { requirements: [] }],
      0
    );
    binder2 = await ethers.deployContract("Binder");
    binderNft2 = await ethers.deployContract("BinderNft", [
      "Binder1",
      "Binder1",
      binder2.address,
    ]);
    await binder2.initialize(
      admin.address,
      binderNft2.address,
      requirementChecker.address,
      [{ requirements: [] }, { requirements: [] }, { requirements: [] }],
      0
    );

    await topLevelBinder.addBinder(1, binder1.address, 2000);
    await binder1.addVersion(1, 0, topLevelBinder.address);
    await topLevelBinder.addBinder(1, binder2.address, 8000);
    await binder2.addVersion(1, 1, topLevelBinder.address);
    await topLevelBinder.activateVersion(1, pmonStore.address);
  });

  it("revert if PmonStore is already in use", async function () {
    await topLevelBinder.addBinder(2, binder1.address, 8000);
    await binder1.addVersion(2, 0, topLevelBinder.address);
    await topLevelBinder.addBinder(2, binder2.address, 2000);
    await binder2.addVersion(2, 1, topLevelBinder.address);

    await expect(topLevelBinder.activateVersion(2, pmonStore.address)).to.be
      .reverted;
  });
});
