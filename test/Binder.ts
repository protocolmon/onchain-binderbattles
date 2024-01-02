import { expect } from "chai";

describe("Binder NFTs", function () {
  it("createBinderNft should create a new empty binder NFT", async function () {
    const [user] = await ethers.getSigners();

    const binder = await ethers.deployContract("Binder");
    await binder.initialize("Binder", "Binder");

    await binder.connect(user).createBinderNft();
    expect(await binder.ownerOf(0)).to.equal(user.address);
    // TODO test that the binder is empty when the slot definition is implemented
  });
});

async function stake(
  user,
  nftContract,
  binder,
  binderNftId,
  slots,
  replace = false
) {
  await nftContract.connect(user).setApprovalForAll(binder.address, true);

  const nfts = [];
  for (let slotId of slots) {
    const tokenId = await nftContract.tokenIndex();
    await nftContract.mint(user.address);
    nfts.push({
      tokenContract: nftContract.address,
      tokenId,
      slotId,
    });
  }

  await binder.connect(user).stakeToBinderNft(binderNftId, nfts, replace);
}

async function check_rewards(binder, expectedRewards, version = 1) {
  for (let expected of expectedRewards) {
    expect(
      await binder.getCurrentRewardAmount(expected.user.address, version)
    ).to.equal(expected.amount);
  }
}

describe("Rewards", function () {
  let admin, user1, user2, user3;
  let pmon;
  let pmonStore;
  let polymonNfts;
  let topLevelBinder;
  let binder1, binder2;

  beforeEach(async function () {
    [admin, user1, user2, user3] = await ethers.getSigners();

    pmon = await ethers.deployContract("MockPmon");
    pmonStore = await ethers.deployContract("PmonStore");

    polymonNfts = await ethers.deployContract("MockERC721");

    topLevelBinder = await ethers.deployContract("TopLevelBinder");
    await topLevelBinder.initialize(admin.address, pmon.address);
    binder1 = await ethers.deployContract("Binder");
    await binder1.initialize("Binder1", "Binder1");
    binder2 = await ethers.deployContract("Binder");
    await binder2.initialize("Binder2", "Binder2");

    await topLevelBinder.addBinder(1, binder1.address, 2000);
    await binder1.addVersion(1, 0, topLevelBinder.address);
    await topLevelBinder.addBinder(1, binder2.address, 8000);
    await binder2.addVersion(1, 1, topLevelBinder.address);
    await topLevelBinder.activateVersion(1, pmonStore.address);
  });

  it("Rewards should be distributed by user shares and parent binder shares", async function () {
    // stake
    await binder1.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder1, 0, [0]);

    await binder1.connect(user2).createBinderNft();
    await stake(user2, polymonNfts, binder1, 1, [0, 1, 2]);

    await binder2.connect(user3).createBinderNft();
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
    await binder2.connect(user3).createBinderNft();
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
    await binder2.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder2, 1, [0]);

    // check rewards
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
    await binder2.connect(user3).createBinderNft();
    await stake(user3, polymonNfts, binder2, 0, [0, 1]);

    await binder2.connect(user1).createBinderNft();
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
