import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { MockERC721, RequirementChecker } from "../typechain-types";
import { stake } from "./utils";

describe("Stake", function () {
  let admin: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress;
  let polymonNfts: MockERC721;
  let requirementChecker: RequirementChecker;

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();
    polymonNfts = await ethers.deployContract("MockERC721");
    requirementChecker = await ethers.deployContract("RequirementChecker", [
      admin.address,
    ]);
    await requirementChecker.whitelistNftContract(polymonNfts.address);
  });

  it("createBinderNft should create a new empty binder NFT", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      []
    );

    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);
    // TODO test that the binder is empty when the slot definition is implemented
  });

  it("revert when staking nfts from non-whitelisted contract", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // stake a non-whitelisted NFT
    const nonWhitelistedNft = await ethers.deployContract("MockERC721");
    await expect(stake(user1, nonWhitelistedNft, binder, 0, [0])).to.be
      .reverted;
  });

  it("revert when staking nfts in a non existing slot", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // stake a non-whitelisted NFT
    await expect(stake(user1, polymonNfts, binder, 0, [1])).to.be.reverted;
  });

  it("revert when staking nft with invalid traits", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [
        {
          requirements: [{ traitId: 0, acceptedTraitValues: [3] }],
        },
      ]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // stake a nft with invalid trait
    await expect(stake(user1, polymonNfts, binder, 0, [0], false, [[2]])).to.be
      .reverted;
  });

  it("revert when staking nft without replace flag on non empty slot", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // occupy the slot
    await stake(user1, polymonNfts, binder, 0, [0]);

    // stake on occupied slot without replace flag
    await expect(stake(user1, polymonNfts, binder, 0, [0])).to.be.reverted;
  });

  it("replace nft", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // occupy the slot
    await stake(user1, polymonNfts, binder, 0, [0]);

    // check owner
    expect(await polymonNfts.ownerOf(0)).to.equal(binder.address);

    // TODO check share

    // stake on occupied slot
    await stake(user1, polymonNfts, binder, 0, [0], true);

    // check owner
    expect(await polymonNfts.ownerOf(0)).to.equal(user1.address);
    expect(await polymonNfts.ownerOf(1)).to.equal(binder.address);

    // TODO check share
  });

  it("replace nft from different contract", async function () {
    const polymonNfts2 = await ethers.deployContract("MockERC721");
    await requirementChecker.whitelistNftContract(polymonNfts2.address);

    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // occupy the slot
    await stake(user1, polymonNfts, binder, 0, [0]);

    // check owner
    expect(await polymonNfts.ownerOf(0)).to.equal(binder.address);

    // TODO check share

    // stake on occupied slot
    await stake(user1, polymonNfts2, binder, 0, [0], true);

    // check owner
    expect(await polymonNfts.ownerOf(0)).to.equal(user1.address);
    expect(await polymonNfts2.ownerOf(0)).to.equal(binder.address);

    // TODO check share
  });

  it("stake with requirements", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [
        {
          requirements: [{ traitId: 0, acceptedTraitValues: [3] }],
        },
      ]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // stake a nft with valid trait
    await stake(user1, polymonNfts, binder, 0, [0], false, [[3]]);

    // check owner
    expect(await polymonNfts.ownerOf(0)).to.equal(binder.address);

    // TODO check share
  });

  it("stake multiple nfts with requirements", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [
        {
          requirements: [
            { traitId: 0, acceptedTraitValues: [3] },
            { traitId: 1, acceptedTraitValues: [1] },
          ],
        },
        {
          requirements: [{ traitId: 0, acceptedTraitValues: [4, 2] }],
        },
        {
          requirements: [
            { traitId: 0, acceptedTraitValues: [1, 2] },
            { traitId: 1, acceptedTraitValues: [1] },
          ],
        },
      ]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    // stake multiple nfts with valid traits
    await stake(user1, polymonNfts, binder, 0, [0, 1, 2], false, [
      [3, 1],
      [2, 0],
      [1, 1],
    ]);

    // check owner
    expect(await polymonNfts.ownerOf(0)).to.equal(binder.address);
    expect(await polymonNfts.ownerOf(1)).to.equal(binder.address);
    expect(await polymonNfts.ownerOf(2)).to.equal(binder.address);

    // TODO check share
  });

  it("revert when staking Nfts owned by others", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }, { requirements: [] }]
    );
    await binderNft.connect(user1).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user1.address);

    await polymonNfts.connect(user2).setApprovalForAll(binder.address, true);
    await polymonNfts.mint(user2.address, [], 1000);

    // stake a nft owned by others
    await expect(
      binder.connect(user1).stakeToBinderNft(
        0,
        [
          {
            tokenContract: polymonNfts.address,
            tokenId: 0,
            slotId: 0,
          },
        ],
        false
      )
    ).to.be.reverted;

    // stake nft
    await binderNft.connect(user2).createBinderNft();
    await binder.connect(user2).stakeToBinderNft(
      1,
      [
        {
          tokenContract: polymonNfts.address,
          tokenId: 0,
          slotId: 0,
        },
      ],
      false
    );

    // check owner
    expect(await polymonNfts.ownerOf(0)).to.equal(binder.address);

    // try to stake it again
    await expect(
      binder.connect(user1).stakeToBinderNft(
        0,
        [
          {
            tokenContract: polymonNfts.address,
            tokenId: 0,
            slotId: 0,
          },
        ],
        true
      )
    ).to.be.reverted;
    await expect(
      binder.connect(user2).stakeToBinderNft(
        1,
        [
          {
            tokenContract: polymonNfts.address,
            tokenId: 0,
            slotId: 1,
          },
        ],
        true
      )
    ).to.be.reverted;
    await binderNft.connect(user2).createBinderNft();
    await expect(
      binder.connect(user2).stakeToBinderNft(
        2,
        [
          {
            tokenContract: polymonNfts.address,
            tokenId: 0,
            slotId: 0,
          },
        ],
        true
      )
    ).to.be.reverted;
  });

  it("revert when staking Nfts to binder owned by others", async function () {
    const binder = await ethers.deployContract("Binder");
    const binderNft = await ethers.deployContract("BinderNft", [
      "Binder",
      "Binder",
      binder.address,
    ]);
    await binder.initialize(
      admin.address,
      binderNft.address,
      requirementChecker.address,
      [{ requirements: [] }]
    );
    await binderNft.connect(user2).createBinderNft();
    expect(await binderNft.ownerOf(0)).to.equal(user2.address);

    // stake a nft to a binder owned by others
    await expect(stake(user1, polymonNfts, binder, 0, [0])).to.be.reverted;
  });
});
