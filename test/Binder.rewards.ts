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
import { check_rewards, deployBinder, stake } from "./utils";

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

    requirementChecker = await ethers.deployContract("RequirementChecker", [
      admin.address,
    ]);
    await requirementChecker.whitelistNftContract(polymonNfts.address);

    let binderDeployment = await deployBinder(
      admin,
      requirementChecker,
      [{ requirements: [] }, { requirements: [] }, { requirements: [] }],
      0
    );
    binder1 = binderDeployment.binder;
    binderNft1 = binderDeployment.binderNft;

    binderDeployment = await deployBinder(
      admin,
      requirementChecker,
      [{ requirements: [] }, { requirements: [] }, { requirements: [] }],
      0
    );
    binder2 = binderDeployment.binder;
    binderNft2 = binderDeployment.binderNft;

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

  // Setup:
  //
  // TopLevelBinder-|-Binder1(20%)
  //                |
  //                |-ParentBinder1(30%)-|-Binder2(100%)
  //                |
  //                |-ParentBinder2(50%)-|-Binder3(10%)
  //                                     |
  //                                     |-Binder4(50%)
  //                                     |
  //                                     |-ParentBinder3(40)-|-Binder5(70)
  //                                                         |
  //                                                         |-Binder6(30)
  it("Rewards should be distributed by user shares and parent binder shares - multilevel setup", async function () {
    // deploy & setup
    topLevelBinder = await ethers.deployContract("TopLevelBinder");
    await topLevelBinder.initialize(admin.address, pmon.address);

    pmonStore = await ethers.deployContract("PmonStore", [
      topLevelBinder.address,
      pmon.address,
    ]);

    const binders = await Promise.all(
      [0, 1, 2, 3, 4, 5].map(async () =>
        deployBinder(
          admin,
          requirementChecker,
          [{ requirements: [] }, { requirements: [] }, { requirements: [] }],
          0
        )
      )
    );
    const parentBinders = await Promise.all(
      [0, 1, 2, 3, 4, 5].map(async () => {
        const parentBinder = await ethers.deployContract("ParentBinder");
        parentBinder.initialize(admin.address);
        return parentBinder;
      })
    );

    // lvl 1
    await topLevelBinder.addBinder(1, binders[0].binder.address, 2000);
    await binders[0].binder.addVersion(1, 0, topLevelBinder.address);

    await topLevelBinder.addBinder(1, parentBinders[0].address, 3000);
    await parentBinders[0].addVersion(1, 1, topLevelBinder.address);

    await topLevelBinder.addBinder(1, parentBinders[1].address, 5000);
    await parentBinders[1].addVersion(1, 2, topLevelBinder.address);

    // lvl 2
    await parentBinders[0].addBinder(1, binders[1].binder.address, 10000);
    await binders[1].binder.addVersion(1, 0, parentBinders[0].address);

    await parentBinders[1].addBinder(1, binders[2].binder.address, 1000);
    await binders[2].binder.addVersion(1, 0, parentBinders[1].address);
    await parentBinders[1].addBinder(1, binders[3].binder.address, 5000);
    await binders[3].binder.addVersion(1, 1, parentBinders[1].address);
    await parentBinders[1].addBinder(1, parentBinders[2].address, 4000);
    await parentBinders[2].addVersion(1, 2, parentBinders[1].address);

    // lvl 3
    await parentBinders[2].addBinder(1, binders[4].binder.address, 7000);
    await binders[4].binder.addVersion(1, 0, parentBinders[2].address);
    await parentBinders[2].addBinder(1, binders[5].binder.address, 3000);
    await binders[5].binder.addVersion(1, 1, parentBinders[2].address);

    // activate
    // TODO propagate or call every parent binder?
    await parentBinders[2].activateVersion(1);
    await parentBinders[1].activateVersion(1);
    await parentBinders[0].activateVersion(1);

    await topLevelBinder.activateVersion(1, pmonStore.address);

    // stake
    // user 1 should get 20% of the pool
    // user 2 should get 30% of the pool
    // user 3 should get 50% of the pool
    for (const { binder, binderNft } of binders) {
      await binderNft.connect(user1).createBinderNft();
      await stake(user1, polymonNfts, binder, 0, [0], false, undefined, [2000]);
      await binderNft.connect(user2).createBinderNft();
      await stake(user2, polymonNfts, binder, 1, [0], false, undefined, [3000]);
      await binderNft.connect(user3).createBinderNft();
      await stake(user3, polymonNfts, binder, 2, [0], false, undefined, [5000]);
    }

    // add rewards
    await pmon.transfer(pmonStore.address, 10_000);

    // Reward distribution
    //
    // TopLevelBinder-|-Binder1(2_000)
    //                |
    //                |-ParentBinder1(3_000)-|-Binder2(3_000)
    //                |
    //                |-ParentBinder2(5_000)-|-Binder3(500)
    //                                       |
    //                                       |-Binder4(2_500)
    //                                       |
    //                                       |-ParentBinder3(2_000)-|-Binder5(1_400)
    //                                                              |
    //                                                              |-Binder6(600)

    // check rewards
    const rewardDistribution = [2000, 3000, 500, 2500, 1400, 600];
    for (let i = 0; i < binders.length; i++) {
      const { binder } = binders[i];
      const totalBinderReward = rewardDistribution[i];
      await check_rewards(binder, [
        { user: user1, amount: Math.floor(totalBinderReward * 0.2) },
        { user: user2, amount: Math.floor(totalBinderReward * 0.3) },
        { user: user3, amount: Math.floor(totalBinderReward * 0.5) },
      ]);
    }

    // user 1 claim
    for (const { binder } of binders) {
      binder.claimReward(user1.address, 1);
    }

    // check
    let user1Total = 0;
    for (let i = 0; i < binders.length; i++) {
      const { binder } = binders[i];
      const totalBinderReward = rewardDistribution[i];
      await check_rewards(binder, [
        { user: user1, amount: 0 },
        { user: user2, amount: Math.floor(totalBinderReward * 0.3) },
        { user: user3, amount: Math.floor(totalBinderReward * 0.5) },
      ]);
      user1Total += Math.floor(totalBinderReward * 0.2);
    }
    expect(await pmon.balanceOf(user1.address)).to.equal(user1Total);

    // add rewards
    await pmon.transfer(pmonStore.address, 10_000);

    // check
    for (let i = 0; i < binders.length; i++) {
      const { binder } = binders[i];
      const totalBinderReward = rewardDistribution[i];
      await check_rewards(binder, [
        { user: user1, amount: Math.floor(totalBinderReward * 0.2) },
        { user: user2, amount: Math.floor(totalBinderReward * 0.3) * 2 },
        { user: user3, amount: Math.floor(totalBinderReward * 0.5) * 2 },
      ]);
    }

    // claim everything
    for (const user of [user1, user2, user3]) {
      for (const { binder } of binders) {
        binder.claimReward(user.address, 1);
      }
    }

    // check
    let user2Total = 0;
    let user3Total = 0;
    for (let i = 0; i < binders.length; i++) {
      const { binder } = binders[i];
      const totalBinderReward = rewardDistribution[i];
      await check_rewards(binder, [
        { user: user1, amount: 0 },
        { user: user2, amount: 0 },
        { user: user3, amount: 0 },
      ]);
      user1Total += Math.floor(totalBinderReward * 0.2);
      user2Total += Math.floor(totalBinderReward * 0.3) * 2;
      user3Total += Math.floor(totalBinderReward * 0.5) * 2;
    }
    expect(await pmon.balanceOf(user1.address)).to.equal(user1Total);
    expect(await pmon.balanceOf(user2.address)).to.equal(user2Total);
    expect(await pmon.balanceOf(user3.address)).to.equal(user3Total);

    expect(await pmon.balanceOf(pmonStore.address)).to.equal(0);
  });

  it("transferFrom should update the shares and rewards", async function () {
    // stake
    await binderNft1.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder1, 0, [0]);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
    ]);

    // check shares
    let userShares = await binder1.userShares(user1.address);
    expect(userShares).to.equal(1000);
    userShares = await binder1.userShares(user2.address);
    expect(userShares).to.equal(0);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 2000 },
      { user: user2, amount: 0 },
    ]);

    // transfer
    await binderNft1
      .connect(user1)
      .transferFrom(user1.address, user2.address, 0);
    expect(await binderNft1.ownerOf(0)).to.equal(user2.address);

    // check shares
    userShares = await binder1.userShares(user1.address);
    expect(userShares).to.equal(0);
    userShares = await binder1.userShares(user2.address);
    expect(userShares).to.equal(1000);

    // check rewards
    await check_rewards(binder1, [
      // user1 rewards should be claimed
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
    ]);
  });

  it("safeTransferFrom should update the shares and rewards", async function () {
    // stake
    await binderNft1.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder1, 0, [0]);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
    ]);

    // check shares
    let userShares = await binder1.userShares(user1.address);
    expect(userShares).to.equal(1000);
    userShares = await binder1.userShares(user2.address);
    expect(userShares).to.equal(0);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 2000 },
      { user: user2, amount: 0 },
    ]);

    // transfer
    await binderNft1
      .connect(user1)
      ["safeTransferFrom(address,address,uint256,bytes)"](
        user1.address,
        user2.address,
        0,
        []
      );
    expect(await binderNft1.ownerOf(0)).to.equal(user2.address);

    // check shares
    userShares = await binder1.userShares(user1.address);
    expect(userShares).to.equal(0);
    userShares = await binder1.userShares(user2.address);
    expect(userShares).to.equal(1000);

    // check rewards
    await check_rewards(binder1, [
      // user1 rewards should be claimed
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
    ]);
  });

  it("safeTransferFrom should update the shares and rewards", async function () {
    // stake
    await binderNft1.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder1, 0, [0]);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
    ]);

    // check shares
    let userShares = await binder1.userShares(user1.address);
    expect(userShares).to.equal(1000);
    userShares = await binder1.userShares(user2.address);
    expect(userShares).to.equal(0);

    // add rewards
    await pmon.transfer(pmonStore.address, 10000);

    // check rewards
    await check_rewards(binder1, [
      { user: user1, amount: 2000 },
      { user: user2, amount: 0 },
    ]);

    // transfer
    await binderNft1
      .connect(user1)
      ["safeTransferFrom(address,address,uint256)"](
        user1.address,
        user2.address,
        0
      );
    expect(await binderNft1.ownerOf(0)).to.equal(user2.address);

    // check shares
    userShares = await binder1.userShares(user1.address);
    expect(userShares).to.equal(0);
    userShares = await binder1.userShares(user2.address);
    expect(userShares).to.equal(1000);

    // check rewards
    await check_rewards(binder1, [
      // user1 rewards should be claimed
      { user: user1, amount: 0 },
      { user: user2, amount: 0 },
    ]);
  });
});
