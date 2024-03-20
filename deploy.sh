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
    echo "Merging with the main branch..."
    git merge main
    echo "Pushing..."
    git push
    echo "Returning to the main branch..."
    git checkout main
}

echo "Verifying if the branch is main..."
if [ $(git rev-parse --abbrev-ref HEAD) == "main" ]; then
    echo "Checking if there are changes to add to git..."
    if [ -n "$(git status --porcelain)" ]; then
        deploy
        echo "Deploy completed."
    else
        echo "No changes were made. To run the script there must be changes."
    fi
else
    echo "Please switch to the main branch to run the script."
fi
