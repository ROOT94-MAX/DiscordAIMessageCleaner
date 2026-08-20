	// ==================== 12. REVIEW BATCHER ====================
	// Splits the user's messages into AI review batches bounded by both a
	// message count and a character budget. Item indexes are positions in the
	// exact `messages` array passed in, so verdicts map back unambiguously.

	const ReviewBatcher = {
		MAX_ITEM_CHARS: 1500,
		build(messages, options) {
			const batchSize = Utils.clamp(Utils.num(options.batchSize, 40), 1, 200);
			const charBudget = Utils.clamp(Utils.num(options.batchCharBudget, 12000), 1000, 200000);
			const batches = [];
			let current = [];
			let chars = 0;
			for (let index = 0; index < messages.length; index++) {
				const message = messages[index];
				const text = Utils.truncate(Utils.stripEmojiTags(message.content), ReviewBatcher.MAX_ITEM_CHARS);
				const item = { i: index, time: Utils.formatDateTime(message.timestamp), text, att: message.attachments.length };
				const size = text.length + 40; // rough JSON envelope overhead
				if (current.length && (current.length >= batchSize || chars + size > charBudget)) {
					batches.push(current);
					current = [];
					chars = 0;
				}
				current.push(item);
				chars += size;
			}
			if (current.length) batches.push(current);
			return batches;
		},
		estimateTokens(messages) {
			let total = 600; // system prompt overhead
			for (const message of messages) {
				total += Utils.estimateTokens(Utils.truncate(Utils.stripEmojiTags(message.content), ReviewBatcher.MAX_ITEM_CHARS)) + 15;
			}
			return total;
		}
	};

