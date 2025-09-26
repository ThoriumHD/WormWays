import { TilingSprite, Texture, Assets, WRAP_MODES, Application } from 'pixi.js';

export default class Background {
  public sprite: TilingSprite;
  private app: Application;
  private mode: 'screenLocked' | 'worldLocked' = 'screenLocked';
  private parallax = 1.0;

  private constructor(app: Application, texture: Texture) {
    this.app = app;

    texture.baseTexture.wrapMode = WRAP_MODES.REPEAT;

    this.sprite = new TilingSprite({
      texture,
      width: app.screen.width,
      height: app.screen.height,
    });

    const onResize = () => {
      this.sprite.width = app.screen.width;
      this.sprite.height = app.screen.height;
    };

    // Pixi v8
    app.renderer.on('resize', onResize);
    onResize();
  }

  static async create(app: Application, url = '/assets/hex-tile.png') {
    const texture = await Assets.load<Texture>(url);
    return new Background(app, texture);
  }

  setWorldLocked(enabled: boolean) {
    this.mode = enabled ? 'worldLocked' : 'screenLocked';
  }
  setParallax(factor: number) {
    this.parallax = factor;
  }

  update(camera: { x: number; y: number; zoom: number }) {
    if (this.mode === 'screenLocked') {
      this.sprite.scale.set(1);
      this.sprite.position.set(0, 0);
      this.sprite.tilePosition.set(-camera.x * this.parallax, -camera.y * this.parallax);
    } else {
      this.sprite.scale.set(camera.zoom);
      const worldOffsetX = -camera.x * camera.zoom + this.app.screen.width / 2;
      const worldOffsetY = -camera.y * camera.zoom + this.app.screen.height / 2;
      this.sprite.position.set(worldOffsetX, worldOffsetY);
      this.sprite.tilePosition.set(0, 0);
    }
  }
}
