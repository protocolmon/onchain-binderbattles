import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { MockPmon, PmonStore } from "../typechain-types";

describe("PmonStore", function () {
  const START_BALANCE = 100;

  let topLevelBinder: SignerWithAddress, user: SignerWithAddress;
  let pmon: MockPmon;
  let pmonStore: PmonStore;

  beforeEach(async function () {
    [topLevelBinder, user] = await ethers.getSigners();

    pmon = await ethers.deployContract("MockPmon");

    pmonStore = await ethers.deployContract("PmonStore", [
      topLevelBinder.address,
      pmon.address,
    ]);

    await pmon.transfer(pmonStore.address, START_BALANCE);
  });

  it("revert transfer from invalid caller", async function () {
    await expect(
      pmonStore.connect(user).transferPmon(user.address, START_BALANCE)
    ).to.be.reverted;
  });

  it("transfer pmon", async function () {
    // transfer pmon from the store to the user
    await pmonStore
      .connect(topLevelBinder)
      .transferPmon(user.address, START_BALANCE / 2);
    expect(await pmon.balanceOf(user.address)).to.equal(START_BALANCE / 2);
    expect(await pmon.balanceOf(pmonStore.address)).to.equal(START_BALANCE / 2);

    // revert when transferring more than the balance
    await expect(
      pmonStore
        .connect(topLevelBinder)
        .transferPmon(user.address, START_BALANCE / 2 + 1)
    ).to.be.reverted;
  });
});
