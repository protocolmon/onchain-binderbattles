import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import {
  Binder,
  BinderNft,
  MockERC721,
  MockPmon,
  PmonStore,
  RequirementChecker,
  TopLevelBinder,
} from "../typechain-types";
import { check_rewards, stake } from "./utils";

describe("Rewards", function () {
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

    requirementChecker = await ethers.deployContract("RequirementChecker", [admin.address]);
    await requirementChecker.whitelistNftContract(polymonNfts.address);

    binder1 = await ethers.deployContract("Binder");
    binderNft1 = await ethers.deployContract("BinderNft", ["Binder1", "Binder1", binder1.address]);
    await binder1.initialize(
      admin.address,
      binderNft1.address,
      requirementChecker.address,
      [{ requirements: [] }, { requirements: [] }, { requirements: [] }]
    );
    binder2 = await ethers.deployContract("Binder");
    binderNft2 = await ethers.deployContract("BinderNft", ["Binder1", "Binder1", binder2.address]);
    await binder2.initialize(
      admin.address,
      binderNft2.address,
      requirementChecker.address,
      [{ requirements: [] }, { requirements: [] }, { requirements: [] }]
    );

    await topLevelBinder.addBinder(1, binder1.address, 2000);
    await binder1.addVersion(1, 0, topLevelBinder.address);
    await topLevelBinder.addBinder(1, binder2.address, 8000);
    await binder2.addVersion(1, 1, topLevelBinder.address);
    await topLevelBinder.activateVersion(1, pmonStore.address);
  });

  it("Rewards should be distributed by user shares and parent binder shares", async function () {
    // stake
    await binderNft1.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder1, 0, [0]);

    await binderNft1.connect(user2).createBinderNft();
    await stake(user2, polymonNfts, binder1, 1, [0, 1, 2]);

    await binderNft2.connect(user3).createBinderNft();
    await stake(user3, polymonNfts, binder2, 0, [0]);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
      { user: user3, amount: 0 },
    ]);
    await check_rewards(binder2, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
      { user: user3, amount: 0 },
    ]);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 2000 / 4 },
      { user: user2, amount: (2000 / 4) * 3 },
      { user: user3, amount: 0 },
    ]);
    await check_rewards(binder2, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
      { user: user3, amount: 8000 },
    ]);
  });

  it("Rewards should be distributed correctly if new user stakes", async function () {
    // stake
    await binderNft2.connect(user3).createBinderNft();
    await stake(user3, polymonNfts, binder2, 0, [0]);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder2, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
      { user: user3, amount: 8000 },
    ]);

    // stake with new user
    await binderNft2.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder2, 1, [0]);

    // check rewards
    expect(await pmon.balanceOf(user1.address)).to.equal(0);
    await check_rewards(binder2, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
      { user: user3, amount: 8000 },
    ]);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder2, [
      { user: user1, amount: 4000 },
      { user: user2, amount: 0 },
      { user: user3, amount: 12000 },
    ]);
  });

  it("Rewards should be distributed correctly if user reduce his stake", async function () {
    // stake
    await binderNft2.connect(user3).createBinderNft();
    await stake(user3, polymonNfts, binder2, 0, [0, 1]);

    await binderNft2.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder2, 1, [0, 1]);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder2, [
      { user: user1, amount: 4000 },
      { user: user2, amount: 0 },
      { user: user3, amount: 4000 },
    ]);

    // reduce stake
    await binder2.connect(user1).unstakeFromBinderNft(1, [
      {
        tokenContract: polymonNfts.address,
        tokenId: 2,
        slotId: 0,
      },
    ]);

    // check rewards
    expect(await pmon.balanceOf(user1.address)).to.equal(4000);
    await check_rewards(binder2, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
      { user: user3, amount: 4000 },
    ]);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder2, [
      { user: user1, amount: Math.floor(8000 / 3) },
      { user: user2, amount: 0 },
      { user: user3, amount: Math.floor((8000 / 3) * 2) + 4000 },
    ]);
  });
});
