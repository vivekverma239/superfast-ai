ALTER TABLE `message` RENAME COLUMN "chatId" TO "threadId";--> statement-breakpoint
CREATE TABLE `memory` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`userId` text(40) NOT NULL,
	`memory` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_userid_idx` ON `memory` (`userId`);--> statement-breakpoint
DROP INDEX `chat_message_chatid_idx`;--> statement-breakpoint
ALTER TABLE `message` ADD `message` text;--> statement-breakpoint
CREATE INDEX `thread_message_threadid_idx` ON `message` (`threadId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `message` DROP COLUMN `role`;--> statement-breakpoint
ALTER TABLE `message` DROP COLUMN `content`;