# Custom celebration videos (optional)

When a player guesses correctly within the first 5 seconds, the game plays a funny
dancing-popcorn animation. You can also add your own short funny clips:

1. Put short `.mp4` or `.webm` files (2–8 seconds, under 5 MB) in this folder.
2. List them in `config.json`:

```json
"celebrationVideos": ["celebrations/dance.mp4", "celebrations/laugh.webm"]
```

The game then picks one of your videos or the popcorn animation at random.
Only use videos you made yourself or have permission to use.
