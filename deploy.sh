#!/bin/bash

echo "Verificando si el branch es el principal..."
if [ $(git rev-parse --abbrev-ref HEAD) == "main" ]; then
    echo "Agregando todos los cambios..."
    git add .
    echo "Generando un commit..."
    read -p "Por favor ingrese el mensaje del commit: " message
    git commit -m "$message"
    echo "Haciendo push..."
    git push
    echo "Cambiando al branch aws..."
    git checkout aws
    echo "Haciendo pull..."
    git pull
    echo "Realizando merge con el branch principal..."
    git merge main
    echo "Haciendo push..."
    git push
    echo "Volviendo al branch principal..."
    git checkout main
else
    read -p "No estás en el branch principal. ¿Deseas cambiar al branch principal? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        git checkout main
        echo "Agregando todos los cambios..."
        git add .
        echo "Generando un commit..."
        read -p "Por favor ingrese el mensaje del commit: " message
        git commit -m "$message"
        echo "Haciendo push..."
        git push
        echo "Cambiando al branch aws..."
        git checkout aws
        echo "Haciendo pull..."
        git pull
        echo "Realizando merge con el branch principal..."
        git merge main
        echo "Haciendo push..."
        git push
        echo "Volviendo al branch principal..."
        git checkout main
    else
        echo "No se realizaron cambios. Por favor cambia al branch principal para ejecutar el script."
    fi
fi
