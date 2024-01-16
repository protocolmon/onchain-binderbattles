import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "hardhat-contract-sizer";

const config: HardhatUserConfig = {
  solidity: "0.8.21",
};

export default config;
