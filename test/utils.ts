import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Binder, MockERC721 } from "../typechain-types";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function stake(
  user: SignerWithAddress,
  nftContract: MockERC721,
  binder: Binder,
  binderNftId: number,
  slots: number[],
  replace = false,
  traits: number[][] | undefined = undefined,
  rarities: number[] | undefined = undefined,
  removedRarities: number[] = []
) {
  await nftContract.connect(user).setApprovalForAll(binder.address, true);

  if (rarities === undefined) {
    rarities = Array(slots.length).fill(1000);
  }

  const nfts = [];
  for (let i = 0; i < slots.length; i++) {
    const slotId = slots[i];
    const tokenId = await nftContract.tokenIndex();
    const _traits = traits ? traits[i] : [];
    await nftContract.mint(user.address, _traits, rarities[i]);
    nfts.push({
      tokenContract: nftContract.address,
      tokenId,
      slotId,
    });
  }

  const prevBinderDataView = await binder.getBinderNft(binderNftId);

  await binder.connect(user).stakeToBinderNft(binderNftId, nfts, replace);

  // check binder changes
  const postBinderDataView = await binder.getBinderNft(binderNftId);
  expect(postBinderDataView.id).to.equal(binderNftId);
  expect(postBinderDataView.id).to.equal(prevBinderDataView.id);
  expect(postBinderDataView.shares).to.equal(Number(prevBinderDataView.shares) + rarities.reduce((acc, curr) => acc + curr, 0) - removedRarities.reduce((acc, curr) => acc + curr, 0));
  for (const nft of nfts) {
    const slot = postBinderDataView.slots[nft.slotId];
    expect(slot.tokenContract).to.equal(nft.tokenContract);
    expect(slot.tokenId).to.equal(nft.tokenId);
  }
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
