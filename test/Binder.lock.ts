import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import {
  Binder,
  BinderNft,
  MockERC721,
  RequirementChecker,
} from "../typechain-types";
import { stake } from "./utils";

describe("Lock", function () {
  const LOCK_TIME = 120;

  let admin: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress;
  let polymonNfts: MockERC721;
  let requirementChecker: RequirementChecker;
  let binder: Binder;
  let binderNft: BinderNft;

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();
    polymonNfts = await ethers.deployContract("MockERC721");
    requirementChecker = await ethers.deployContract("RequirementChecker", [
      admin.address,
    ]);
    await requirementChecker.whitelistNftContract(polymonNfts.address);

    binder = await ethers.deployContract("Binder");
    binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }],
      LOCK_TIME
    );

    // stake nft
    await binderNft.connect(user1).createBinderNft();
    await stake(user1, polymonNfts, binder, 0, [0], false);
  });

  it("unstake should lock the nft", async function () {
    // check lock
    let binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(0);

    // unstake
    await binder.connect(user1).unstakeFromBinderNft(0, [
      {
        tokenContract: polymonNfts.address,
        tokenId: 0,
        slotId: 0,
      },
    ]);

    // check lock
    binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(1);
    expect(binderDataView.lockedNfts[0].nft.tokenContract).to.equal(
      polymonNfts.address
    );
    expect(binderDataView.lockedNfts[0].nft.tokenId).to.equal(0);
  });

  it("replace should lock the nft", async function () {
    // check lock
    let binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(0);

    // replace
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );

    // check lock
    binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(1);
    expect(binderDataView.lockedNfts[0].nft.tokenContract).to.equal(
      polymonNfts.address
    );
    expect(binderDataView.lockedNfts[0].nft.tokenId).to.equal(0);

    // replace
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );

    // check lock
    binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(2);
    expect(binderDataView.lockedNfts[1].nft.tokenContract).to.equal(
      polymonNfts.address
    );
    expect(binderDataView.lockedNfts[1].nft.tokenId).to.equal(1);
  });

  it("should revert if user claims locked nft before lock period is over", async function () {
    // unstake
    await binder.connect(user1).unstakeFromBinderNft(0, [
      {
        tokenContract: polymonNfts.address,
        tokenId: 0,
        slotId: 0,
      },
    ]);

    // claim before lock period is over
    await expect(binder.connect(user1).claimUnlockedNfts(0, [0])).to.be
      .reverted;

    // increase time
    await ethers.provider.send("evm_increaseTime", [LOCK_TIME / 2]);
    await ethers.provider.send("evm_mine");

    // claim before lock period is over
    await expect(binder.connect(user1).claimUnlockedNfts(0, [0])).to.be
      .reverted;
  });

  it("should be able to claim after lock period is over", async function () {
    // unstake
    await binder.connect(user1).unstakeFromBinderNft(0, [
      {
        tokenContract: polymonNfts.address,
        tokenId: 0,
        slotId: 0,
      },
    ]);

    // increase time
    await ethers.provider.send("evm_increaseTime", [LOCK_TIME + 5]);
    await ethers.provider.send("evm_mine");

    // check data
    let binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(1);
    expect(await polymonNfts.ownerOf(0)).to.equal(binder.address);

    // claim with differnet user
    await binder.connect(user1).claimUnlockedNfts(0, [0]);

    // check data
    binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(0);
    expect(await polymonNfts.ownerOf(0)).to.equal(user1.address);
  });

  it("should revert if user claims locked nft for a binder he doesn't own", async function () {
    // unstake
    await binder.connect(user1).unstakeFromBinderNft(0, [
      {
        tokenContract: polymonNfts.address,
        tokenId: 0,
        slotId: 0,
      },
    ]);

    // increase time
    await ethers.provider.send("evm_increaseTime", [LOCK_TIME + 5]);
    await ethers.provider.send("evm_mine");

    // claim with differnet user
    await expect(binder.connect(user2).claimUnlockedNfts(0, [0])).to.be
      .reverted;
  });

  it("should revert if a invalid index is claimed", async function () {
    // unstake
    await binder.connect(user1).unstakeFromBinderNft(0, [
      {
        tokenContract: polymonNfts.address,
        tokenId: 0,
        slotId: 0,
      },
    ]);

    // increase time
    await ethers.provider.send("evm_increaseTime", [LOCK_TIME + 5]);
    await ethers.provider.send("evm_mine");

    // claim with differnet user
    await expect(binder.connect(user2).claimUnlockedNfts(0, [1])).to.be
      .reverted;
  });

  it("should be able to claim multiple nfts at once", async function () {
    // lock multiple nfts
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );

    // check data
    let binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(4);
    for (let i = 0; i < 4; i++) {
      expect(binderDataView.lockedNfts[i].nft.tokenContract).to.equal(
        polymonNfts.address
      );
      expect(binderDataView.lockedNfts[i].nft.tokenId).to.equal(i);
      expect(await polymonNfts.ownerOf(i)).to.equal(binder.address);
    }

    // increase time
    await ethers.provider.send("evm_increaseTime", [LOCK_TIME + 5]);
    await ethers.provider.send("evm_mine");

    // claim
    await binder.connect(user1).claimUnlockedNfts(0, [3, 1, 0]);

    // check data
    binderDataView = await binder.getBinderNft(0);
    expect(binderDataView.lockedNfts.length).to.equal(1);
    expect(binderDataView.lockedNfts[0].nft.tokenContract).to.equal(
      polymonNfts.address
    );
    expect(binderDataView.lockedNfts[0].nft.tokenId).to.equal(2);
    expect(await polymonNfts.ownerOf(0)).to.equal(user1.address);
    expect(await polymonNfts.ownerOf(1)).to.equal(user1.address);
    expect(await polymonNfts.ownerOf(2)).to.equal(binder.address);
    expect(await polymonNfts.ownerOf(3)).to.equal(user1.address);
  });

  it("should revert if the indexes are not sorted in decending order", async function () {
    // lock multiple nfts
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );
    await stake(
      user1,
      polymonNfts,
      binder,
      0,
      [0],
      true,
      undefined,
      [1000],
      [1000]
    );

    // increase time
    await ethers.provider.send("evm_increaseTime", [LOCK_TIME + 5]);
    await ethers.provider.send("evm_mine");

    // claim with invalid order
    await expect(binder.connect(user1).claimUnlockedNfts(0, [3, 0, 1])).to.be
      .reverted;
  });

  it("revert if the lock time gets changed by non GOVERNANCE_ROLE user", async function () {
    await expect(binder.connect(user1).setUnstakeLockPeriod(100)).to.be
      .reverted;
  });

  it("GOVERNANCE_ROLE user should be able to change the lock time", async function () {
    // check lock time
    expect(await binder.unstakeLockPeriod()).to.equal(LOCK_TIME);

    // change lock time
    await binder.connect(admin).setUnstakeLockPeriod(100);

    // check lock time
    expect(await binder.unstakeLockPeriod()).to.equal(100);
  });
});
