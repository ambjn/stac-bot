/**
 * database test script
 * run with: npx ts-node src/test-db.ts
 */

import {
    createRoom,
    getRoom,
    addPlayer,
    getPlayer,
    getPlayers,
    updatePlayerJoined,
    updatePlayerBuyIn,
    getRoomsByUser,
    deleteRoom
} from './db';

console.log('\n🧪 starting database tests...\n');

// test 1: create room
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 1: create room');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const testRoomId = 'test01';
const ownerId = 123456789;
const ownerUsername = 'testowner';

// clean up first
deleteRoom(testRoomId);

const room = createRoom({
    id: testRoomId,
    ownerId,
    ownerUsername
});
console.log('✅ room created:', room);

// test 2: get room
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 2: get room');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const fetchedRoom = getRoom(testRoomId);
console.log('✅ room fetched:', fetchedRoom ? `${fetchedRoom.id} by @${fetchedRoom.ownerUsername}` : 'not found');

// test 3: add players
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 3: add players');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

addPlayer(testRoomId, {
    userId: 0,
    username: 'player1',
    buyIn: 0,
    joined: false
});
console.log('✅ added player1 (invited)');

addPlayer(testRoomId, {
    userId: 0,
    username: 'player2',
    buyIn: 0,
    joined: false
});
console.log('✅ added player2 (invited)');

// test 4: player joins
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 4: player joins');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const player1Id = 111111111;
updatePlayerJoined(testRoomId, 'player1', player1Id);
console.log('✅ player1 joined');

const player1 = getPlayer(testRoomId, player1Id, 'player1');
console.log('   joined status:', player1?.joined ? '✅ yes' : '❌ no');

// test 5: add buy-ins
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 5: add buy-ins');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// owner adds buy-in
const ownerBuyIn = updatePlayerBuyIn(testRoomId, ownerId, ownerUsername, 500, 'add');
console.log('✅ owner added 500:', ownerBuyIn);

// player1 adds buy-in
const player1BuyIn = updatePlayerBuyIn(testRoomId, player1Id, 'player1', 300, 'add');
console.log('✅ player1 added 300:', player1BuyIn);

// player1 adds more
const player1BuyIn2 = updatePlayerBuyIn(testRoomId, player1Id, 'player1', 200, 'add');
console.log('✅ player1 added 200 more:', player1BuyIn2);

// test 6: remove buy-in
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 6: remove buy-in');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const removeResult = updatePlayerBuyIn(testRoomId, player1Id, 'player1', 100, 'remove');
console.log('✅ player1 removed 100:', removeResult);

// try to remove too much
const removeTooMuch = updatePlayerBuyIn(testRoomId, player1Id, 'player1', 9999, 'remove');
console.log('❌ player1 tried to remove 9999:', removeTooMuch);

// test 7: get all players
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 7: get all players');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const players = getPlayers(testRoomId);
console.log('✅ players in room:');
players.forEach(p => {
    console.log(`   @${p.username}: buy-in=${p.buyIn}, joined=${p.joined}`);
    console.log(`   history: ${p.history.length} entries`);
});

// test 8: get rooms by user
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 8: get rooms by user');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const ownerRooms = getRoomsByUser(ownerId, ownerUsername);
console.log('✅ owner rooms:', ownerRooms);

const player1Rooms = getRoomsByUser(player1Id, 'player1');
console.log('✅ player1 rooms:', player1Rooms);

// test 9: room summary data
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('test 9: room summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const finalRoom = getRoom(testRoomId);
if (finalRoom) {
    const total = finalRoom.players.reduce((sum, p) => sum + p.buyIn, 0);
    console.log(`📊 room: ${finalRoom.id}`);
    console.log(`👑 owner: @${finalRoom.ownerUsername}`);
    console.log(`👥 players: ${finalRoom.players.length}`);
    console.log(`💰 total buy-in: ${total}`);
    finalRoom.players.forEach(p => {
        const pct = total > 0 ? ((p.buyIn / total) * 100).toFixed(1) : '0';
        console.log(`   @${p.username}: ${p.buyIn} (${pct}%)`);
    });
}

// cleanup
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('cleanup');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
deleteRoom(testRoomId);
console.log('✅ test room deleted');

console.log('\n🎉 all tests completed!\n');
