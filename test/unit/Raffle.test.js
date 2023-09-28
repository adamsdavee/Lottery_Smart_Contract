const { ethers, getNamedAccounts, deployments, network } = require("hardhat");
const { assert, expect } = require("chai");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle unit tests", function () {
      let deployer;
      let raffle, Raffle, interval;
      let VRFMock, vrfCoordinatorMock;
      const sendValue = ethers.parseEther("0.02");
      const chainId = network.config.chainId;
      console.log("Hey there!");
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        console.log("Okay...");

        raffle = await deployments.get("Raffle", deployer);
        console.log(raffle.address);
        Raffle = await ethers.getContractAt("Raffle", raffle.address);

        VRFMock = await deployments.get("VRFCoordinatorV2Mock", deployer);
        vrfCoordinatorMock = await ethers.getContractAt(
          "VRFCoordinatorV2Mock",
          VRFMock.address
        );
        console.log(VRFMock.address);

        interval = await Raffle.getInterval();
        console.log(`Interval value: ${typeof interval}`);
      });

      describe("Constructor", function () {
        it("initializes Raffle correctly", async function () {
          const raffleState = await Raffle.getRaffleState(); // This is an enum but it returns the index i.e 0=OPEN & 1=CALCULATING
          //   console.log(raffleState);
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval, networkConfig[chainId]["interval"]);
        });

        it("sets VRFCoordinator address correctly", async function () {
          const response = await Raffle.getVRFCoordinatorAddress();

          assert.equal(response, VRFMock.address);
        });
      });

      describe("Enter raffle", function () {
        it("Fails if you don't send enough ETH", async function () {
          await expect(Raffle.enterRaffle()).to.be.revertedWithCustomError(
            Raffle,
            "Raffle__NotEnoughETHEntered"
          );
        });

        it("Fails if Raffle state is not open", async function () {
          await Raffle.enterRaffle({ value: sendValue });
          console.log("Okay i'm in here!");
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          // console.log(typeof ethers.toNumber(interval));
          console.log("Checking.....");
          await network.provider.send("evm_mine", []);
          console.log("Another checking....");
          await Raffle.performUpkeep([]);
          console.log("Last checking.....");
          await expect(
            Raffle.enterRaffle({ value: sendValue })
          ).to.be.revertedWithCustomError(Raffle, "Raffle__NotOpen");
        });

        it.only("Updates list of players", async function () {
          const accounts = await ethers.getSigners();
          await Raffle.enterRaffle({ value: sendValue });
          const response = await Raffle.getPlayers(0);
          console.log(`The players: ${response}`);
          assert.equal(response, deployer);

          // If i now connect another account:
          const RaffleConnectedContract = await Raffle.connect(accounts[1]);
          await RaffleConnectedContract.enterRaffle({ value: sendValue });
          const playerTwo = await Raffle.getPlayers(1);
          console.log(`Player 2 is ${playerTwo}`);
          assert.equal(playerTwo, accounts[1].address);

          const numberOfPlayers = await Raffle.getNumberOfPlayers();
          console.log(numberOfPlayers);
          assert.equal(numberOfPlayers.toString(), "2");
        });

        it("emits event on enter", async function () {
          console.log("testing emitting......");
          await expect(Raffle.enterRaffle({ value: sendValue })).to.emit(
            Raffle,
            "RaffleEnter"
          );
        });
      });

      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [
            ethers.toNumber(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          // const { upkeepNeeded } = await Raffle.checkUpkeep("0x");
          const { upkeepNeeded } = await Raffle.checkUpkeep.staticCall("0x");
          assert(!upkeepNeeded);
        });

        it("returns false if raffle isn't open", async function () {
          await Raffle.enterRaffle({ value: sendValue });
          await network.provider.send("evm_increaseTime", [
            ethers.toNumber(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await Raffle.performUpkeep("0x");
          const raffleState = await Raffle.getRaffleState();
          const { upkeepNeeded } = await Raffle.checkUpkeep.staticCall("0x");
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed", async function () {
          await Raffle.enterRaffle({ value: sendValue });
          await network.provider.send("evm_increaseTime", [
            Number(interval) - 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await Raffle.checkUpkeep.staticCall("0x");
          assert(!upkeepNeeded);
        });

        it("returns true if enough time has passed, has players, eth and is open", async function () {
          await Raffle.enterRaffle({ value: sendValue });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await Raffle.checkUpkeep.staticCall("0x");
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {
        it("it can only run if checkUpkeep is true", async function () {
          await Raffle.enterRaffle({ value: sendValue });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await Raffle.performUpkeep("0x");
          assert(tx);
        });

        it("reverts when checkUpkeep is false", async function () {
          await expect(
            Raffle.performUpkeep("0x")
          ).to.be.revertedWithCustomError(Raffle, "Raffle__UpkeepNotNeeded");
        });

        it("updates the raffle state, emits an event and calls the vrf coordinator", async function () {
          await Raffle.enterRaffle({ value: sendValue });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);

          const txResponse = await Raffle.performUpkeep("0x");
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const raffleState = await Raffle.getRaffleState();
          assert(Number(requestId) > 0);
          assert(raffleState.toString() == "1");
        });
      });

      describe("fufillRandomWords", function () {
        beforeEach(async function () {
          await Raffle.enterRaffle({ value: sendValue });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });

        it("can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorMock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorMock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith("nonexistent request");
          console.log(`Raffle address: ${Raffle.address}`);
          console.log(`raffle address: ${raffle.address}`);
          console.log(`Raffle target: ${Raffle.target}`);
          console.log(`raffle target: ${raffle.target}`);
        });

        // Tooooooo bigggggg
        it("picks a winner, resets the lottery and sends money", async function () {
          const additionalEntrants = 3;
          const startingAccountIndex = 1; // deployer = 0
          const accounts = await ethers.getSigners();

          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalEntrants;
            i++
          ) {
            const accountConnectedRaffle = Raffle.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({ value: sendValue });
          }

          const startingTimeStamp = await Raffle.getLatestTimeStamp();

          // performUpkeep (mock being chainlink keepers)
          // fulfillRandomWords (mock being the chainlink VRF)
          await new Promise(async (resolve, reject) => {
            Raffle.once("WinnerPicked", async () => {
              console.log("Found the event!");
              try {
                const recentWinner = await Raffle.getRecentWinner();
                console.log(recentWinner);
                console.log(accounts[2].address);
                console.log(accounts[1].address);
                console.log(accounts[3].address);

                const raffleState = await Raffle.getRaffleState();
                const endingTimeStamp = await Raffle.getLatestTimeStamp();
                const numPlayers = await Raffle.getNumberOfPlayers();
                const winnerEndingBalance = await accounts[1].getBalance();
                assert.equal(numPlayers.toString(), "0");
                assert.equal(endingTimeStamp > startingTimeStamp);

                assert.equal(
                  winnerEndingBalance.toString(),
                  (
                    winnerStartingBalance +
                    sendValue * additionalEntrants +
                    sendValue
                  ).toString()
                );
              } catch (e) {
                reject(e);
              }
              resolve();
            });

            const tx = await Raffle.performUpkeep("0x");
            const txReceipt = await tx.wait(1);
            const winnerStartingBalance = await accounts[1].getBalance();
            await vrfCoordinatorMock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            );
          });
        });
      });
    });
