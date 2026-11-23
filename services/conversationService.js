const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { makePairKey } = require('../utils/chatUtils');

async function dedupeConversations() {
  try {
    const convs = await Conversation.find({}).sort({ createdAt: 1 }).lean();
    if (!convs.length) return;

    const groups = new Map(); // pairKey -> [conversations]
    for (const c of convs) {
      if (!c.participants || c.participants.length !== 2) continue;
      const key = makePairKey(c.participants[0], c.participants[1]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }

    let mergedGroups = 0,
      deletedConvs = 0,
      movedMessages = 0,
      backfilled = 0;

    for (const [pairKey, group] of groups) {
      const canonical = group[0]; // oldest, since we sorted by createdAt above
      const duplicates = group.slice(1);

      if (duplicates.length > 0) {
        const dupIds = duplicates.map(d => d._id);
        const moveResult = await Message.updateMany(
          { conversationID: { $in: dupIds } },
          { $set: { conversationID: canonical._id } }
        );
        movedMessages += moveResult.modifiedCount || 0;

        // Keep whichever lastMessage is actually the most recent overall
        const mostRecent = group.reduce((a, b) =>
          new Date(a.lastMessageAt || 0) > new Date(b.lastMessageAt || 0) ? a : b
        );
        await Conversation.findByIdAndUpdate(canonical._id, {
          pairKey,
          lastMessage: mostRecent.lastMessage || canonical.lastMessage,
          lastMessageAt: mostRecent.lastMessageAt || canonical.lastMessageAt,
        });
        await Conversation.deleteMany({ _id: { $in: dupIds } });
        deletedConvs += dupIds.length;
        mergedGroups++;
      } else if (!canonical.pairKey) {
        await Conversation.findByIdAndUpdate(canonical._id, { pairKey });
        backfilled++;
      }
    }

    if (mergedGroups || backfilled) {
      console.log(
        `🔧  Chat migration: merged ${mergedGroups} duplicate pair(s) (${deletedConvs} extra conversation(s) removed, ${movedMessages} message(s) reattached), backfilled pairKey on ${backfilled} conversation(s).`
      );
    }
  } catch (e) {
    console.error('⚠️  dedupeConversations migration failed (non-fatal):', e.message);
  }
}

module.exports = { dedupeConversations };
