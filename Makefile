# Cheatsheet Maker - GTK3/Cairo C project

APP_NAME=cheatsheet-maker
SRC_DIR=src
OBJ_DIR=build
SRCS=$(wildcard $(SRC_DIR)/*.c)
OBJS=$(patsubst $(SRC_DIR)/%.c,$(OBJ_DIR)/%.o,$(SRCS))
CC=gcc
CFLAGS=-O2 -Wall -Wextra -std=c11 $(shell pkg-config --cflags gtk+-3.0 gdk-pixbuf-2.0 cairo)
LDFLAGS=$(shell pkg-config --libs gtk+-3.0 gdk-pixbuf-2.0 cairo) -lm

all: $(APP_NAME)

$(OBJ_DIR)/%.o: $(SRC_DIR)/%.c
	mkdir -p $(OBJ_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(APP_NAME): $(OBJS)
	$(CC) $(OBJS) -o $@ $(LDFLAGS)

run: $(APP_NAME)
	./$(APP_NAME)

clean:
	rm -rf $(OBJ_DIR) $(APP_NAME)

.PHONY: all run clean

