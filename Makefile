.PHONY: deploy verify-backend-runtime

deploy:
	bash ./server/deploy.sh

verify-backend-runtime:
	node ./scripts/verify-backend-runtime.mjs
