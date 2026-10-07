# Narratives

A glowing domed room with a hole to the sky. Your job: put your work in it.

## Run it

Open the folder in VS Code, install **Live Server**, then right-click `index.html` → **Open with Live Server**.

(Double-clicking the file won't load models.)

## Add a model

1. Put it in `assets/models/`.
2. List it in section 1 of `index.html`:
   ```html
   <a-asset-item id="my-model" src="assets/models/my-model.glb"></a-asset-item>
   ```
   Got a `.gltf`? Keep it with its `.bin` and `textures` folder, all in one folder.
3. Place it in section 2:
   ```html
   <a-entity gltf-model="#my-model" position="0 1.35 0" rotation="0 0 0" scale="1 1 1"></a-entity>
   ```

Images go in `assets/images/` and work the same way with `<img>` and `<a-image>`.

## Where things go

- Floor is `y = 0`. The wall is 9 m from the middle.
- The pit in the middle has a 2.6 m radius and is about 1 m deep.
- You stand at `z = 6.2`, looking toward `z = -9`.

## Stuck?

- **Can't see it?** Press F12. A red 404 means the file path is wrong.
- **Huge or tiny?** Add `fit-model="size: 1.5"`.
- **Not moving?** If it has animation, add `play-clips`.
- **Want a new mood?** Change the dome color in section 4.
