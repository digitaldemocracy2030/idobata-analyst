## ショートカット（自分のよく使うものを登録すると便利）
default: containers-start
lint: frontend-lint backend-lint chat-bot-lint
format: frontend-format backend-format chat-bot-format
test: frontend-test backend-test chat-bot-test

.PHONY: setup

# ターゲット定義（makefile は薄いラッパーとして使う。複雑な処理を書かずシンプルに保つこと）
containers-start:
	docker compose up --watch

setup:
	sh ./copy-env.sh

frontend-lint:
	cd packages/frontend && npm run lint

frontend-format:
	cd packages/frontend && npm run format

frontend-test:
	cd packages/frontend && npm run test

backend-lint:
	cd packages/backend && npm run lint

backend-format:
	cd packages/backend && npm run format

backend-test:
	cd packages/backend && npm run test

chat-bot-lint:
	cd packages/chat-bot && npm run lint

chat-bot-format:
	cd packages/chat-bot && npm run format

chat-bot-test:
	cd packages/chat-bot && npm run test