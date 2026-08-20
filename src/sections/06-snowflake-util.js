	// ==================== 06. SNOWFLAKE UTIL ====================

	const SnowflakeUtil = {
		tsFromId(id) {
			try {
				return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
			} catch (e) {
				return NaN;
			}
		},
		idFromTs(ms) {
			let big = BigInt(Math.max(0, Math.floor(ms))) - DISCORD_EPOCH;
			if (big < 0n) big = 0n;
			return (big << 22n).toString();
		}
	};

