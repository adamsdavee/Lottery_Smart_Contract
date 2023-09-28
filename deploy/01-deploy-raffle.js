const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");
require("dotenv").config();

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("15");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let VRFCoordinatorAddress, subscriptionId;

  if (developmentChains.includes(network.name)) {
    const VRFCD = await deployments.get("VRFCoordinatorV2Mock", deployer);
    VRFCoordinatorAddress = VRFCD.address;
    const VRFCoordinatorMock = await ethers.getContractAt(
      "VRFCoordinatorV2Mock",
      VRFCD.address
    );
    log(`Mock VRFCoordinator address: ${VRFCoordinatorAddress}`);
    const transactionResponse = await VRFCoordinatorMock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    console.log("Under here");
    console.log(transactionReceipt);
    console.log(transactionReceipt.logs[0].topics[1]);
    console.log("FInished!");
    subscriptionId = transactionReceipt.logs[0].topics[1];
    // Fund the subscription
    // Usually, you'd need a link token on a real network
    await VRFCoordinatorMock.fundSubscription(
      subscriptionId,
      VRF_SUB_FUND_AMOUNT
    ); /* const fundingResponse = theres no need for this since its a Mock! */

    // await VRFCoordinatorMock.consumerIsAdded(i_subscriptionId, msg.sender);
    log(`Mock VRFCoordinator address: ${VRFCoordinatorAddress}`);
    log(subscriptionId);
  } else {
    VRFCoordinatorAddress = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
    log(`Testnet VRFCoordinator address ${VRFCoordinatorAddress}`);
  }

  log(`Confirming the particular address: ${VRFCoordinatorAddress}`);

  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];
  const args = [
    VRFCoordinatorAddress,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];
  console.log(args);
  log("Deploying contract.......");
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  console.log(`Contract deployed at ${raffle.address}`);

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying.........");
    await verify(raffle.address, args);
  }
  log("--------------------------");
};

module.exports.tags = ["all", "raffle"];
