const { ethers, getNamedAccounts, deployments, network } = require("hardhat");
const { assert, expect } = require("chai");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle unit tests", function () {
      let deployer;
      let raffle, Raffle, interval;
      const sendValue = ethers.parseEther("0.02");
      //   const chainId = network.config.chainId;
      console.log("Hey there!");
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        // await deployments.fixture(["raffle"]);
        console.log("Okay...");

        raffle = await deployments.get("Raffle", deployer);
        console.log(raffle.address);
        Raffle = await ethers.getContractAt("Raffle", raffle.address);

        interval = await Raffle.getInterval();
      });

      describe("fulfillRandomWords", function () {
        it("works with live Chainlink keepers and Chainlink VRF, we get a random winner", async function () {
          const accounts = await ethers.getSigners();
          console.log(accounts[0].address);
          console.log(deployer);
          // enter the raffle
          console.log("I'm in here!");
          const startingTimeStamp = await Raffle.getLatestTimeStamp();
          console.log(`Timestamp chacking...${startingTimeStamp}`);

          // Then entering the Raffle
          const winnerStartingBalance = await ethers.provider.getBalance(
            deployer
          );
          console.log(winnerStartingBalance);
          await Raffle.enterRaffle({ value: sendValue });
          console.log("Fully funded!");

          console.log("Balance seen");

          // setup a listener
          await new Promise(async (resolve, reject) => {
            console.log("Is it here?");
            Raffle.once("WinnerPicked", async () => {
              console.log("WinnerPicked event fired!");
              try {
                const recentWinner = await Raffle.getRecentWinner();
                const raffleState = await Raffle.getRaffleState();
                // const winnerEndingBalance = await deployer.getBalace();
                const endingTimeStamp = await Raffle.getLatestTimeStamp();

                await expect(Raffle.getPlayers(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), deployer.address);
                assert.equal(raffleState.toString(), "0");
                // assert.equal(
                //   winnerEndingBalance.toString(),
                //   (winnerStartingBalance + sendValue).toString()
                // );
                assert(endingTimeStamp > startingTimeStamp);
                resolve();
              } catch (e) {
                reject(e);
              }
            });
          });
        });
      });
    });
