#!/bin/bash

deploy() {
    echo "Adding all changes..."
    git add .
    echo "Generating a commit..."
    read -p "Please enter the commit message: " message
    git commit -m "$message"
    echo "Pushing..."
    git push
    echo "Switching to the aws branch..."
    git checkout aws
    echo "Pulling..."
    git pull
    echo "Merging with the master branch..."
    git merge main
    echo "Pushing..."
    git push
    echo "Returning to the master branch..."
    git checkout main
}

echo "Verifying if the branch is master..."
if [ $(git rev-parse --abbrev-ref HEAD) == "main" ]; then
    deploy
else
    read -p "You are not in the master branch. Do you want to switch to the master branch? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        git checkout main
        deploy
    else
        echo "No changes were made. Please switch to the master branch to run the script."
    fi
fi
