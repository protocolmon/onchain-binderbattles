import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Binder, MockERC721 } from "../typechain-types";

export async function stake(
  user: SignerWithAddress,
  nftContract: MockERC721,
  binder: Binder,
  binderNftId: number,
  slots: number[],
  replace = false,
  traits: number[][] | undefined = undefined
) {
  await nftContract.connect(user).setApprovalForAll(binder.address, true);

  const nfts = [];
  for (let i = 0; i < slots.length; i++) {
    const slotId = slots[i];
    const tokenId = await nftContract.tokenIndex();
    const _traits = traits ? traits[i] : [];
    await nftContract.mint(user.address, _traits);
    nfts.push({
      tokenContract: nftContract.address,
      tokenId,
      slotId,
    });
  }

  await binder.connect(user).stakeToBinderNft(binderNftId, nfts, replace);
}

export async function check_rewards(
  binder: Binder,
  expectedRewards: { user: SignerWithAddress; amount: number }[],
  version = 1
) {
  for (let expected of expectedRewards) {
    expect(
      await binder.getCurrentRewardAmount(expected.user.address, version)
    ).to.equal(expected.amount);
  }
}
