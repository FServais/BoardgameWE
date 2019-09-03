#!/bin/bash

# any future command that fails will exit the script
set -e

# Lets write the public key of our aws instance
eval $(ssh-agent -s)
echo "$SSH_KEY" | tr -d '\r' | ssh-add - > /dev/null
# pwd
mkdir -p ~/.ssh
# echo -e "$SSH_KEY" > ~/.ssh/id_rsa
# chmod 600 ~/.ssh/id_rsa
echo -e "$SSH_KEY" > ~/.ssh/BGCDev.pem
chmod 600 ~/.ssh/BGCDev.pem
cat ~/.ssh/BGCDev.pem

# disable the host key checking.
bash ./tools/bgcinfra/configs/disableHostKeyChecking.sh