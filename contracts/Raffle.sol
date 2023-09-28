// Raffle

// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// WInner to be selected every X minutes -> completely automated
// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/**
 * @title A sample Raffle Contract
 * @author Adams Dave
 * @notice this contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Types declarations */
    enum RaffleState {
        OPEN,
        CALCULATING
    } // uint256 0 = OPEN, 1 = CALCULATING

    /* State variables */
    uint256 private immutable i_entranceFee;
    address payable[] private players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Lottery variables
    address private recentWinner;
    RaffleState private raffleState;
    uint256 private lastTimeStamp;
    uint256 private immutable i_interval;

    /* Events */
    event RaffleEnter(address indexed player);
    event requestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 _entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 _interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = _entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        raffleState = RaffleState.OPEN; // OR RaffleState(0);
        lastTimeStamp = block.timestamp;
        i_interval = _interval;
    }

    function enterRaffle() public payable {
        // require (msg.value > i_entranceFee, "Not enough ETH!") // But this is not gas efficient as it stores a string.
        // Using custom errors is more gas efficient.
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }

        players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        // Name events with the function name reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev Thid is the function that the Chainlink Keeper nodes call
     * they look for the 'upkeepNeeded' to return true
     * The following should be true in order for it to return true:
     * 1. Our time interval should have passed
     * 2. The lottery should have one player and at least some ETH
     * 3. Our subscription is funded with LINK
     * 4. The lottery should be in an "open' state
     */

    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        override
        returns (bool upkeepNeeded, bytes memory /*performData*/)
    {
        bool isOpen = (RaffleState.OPEN == raffleState);
        bool timePassed = ((block.timestamp - lastTimeStamp) > i_interval);
        bool hasPlayers = (players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upKeepNeeded, ) = checkUpkeep("");
        if (!upKeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                players.length,
                uint256(raffleState)
            );
        }

        // Request the random number
        // Once we get it, do something with it
        // 2 transaction process

        raffleState = RaffleState.CALCULATING;
        // i_vrfCoordinator.addConsumer(i_subscriptionId, msg.sender);

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // which is the keyHash i.e the maximum gas,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit requestedRaffleWinner(requestId); // This is redundant as there is already an event emitted in the mock
    }

    function fulfillRandomWords(
        uint256 /* requestId, */,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % players.length;
        address payable s_recentWinner = players[indexOfWinner];
        recentWinner = s_recentWinner;
        raffleState = RaffleState.OPEN;
        players = new address payable[](0);
        (bool success, ) = s_recentWinner.call{value: address(this).balance}(
            ""
        );
        if (!success) {
            revert Raffle__TransferFailed();
        }

        emit WinnerPicked(s_recentWinner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns (address) {
        return players[index];
    }

    function getRecentWinner() public view returns (address) {
        return recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getVRFCoordinatorAddress()
        public
        view
        returns (VRFCoordinatorV2Interface)
    {
        return i_vrfCoordinator;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getSubscriptionId() public view returns (uint256) {
        return i_subscriptionId;
    }
}
