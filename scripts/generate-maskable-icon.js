const sharp = require("sharp");
const path = require("path");

const inputPath = path.join(__dirname, "../img/favicon-512.png");
const outputPath = path.join(__dirname, "../img/favicon-512-maskable.png");

const size = 512;
const iconSize = Math.round(size * 0.75); // 75% keeps subject well within the 80% safe zone
const bgColor = { r: 222, g: 242, b: 217, alpha: 255 }; // #def2d9

async function generate() {
  const resized = await sharp(inputPath)
    .resize(iconSize, iconSize, {
      fit: "contain",
      background: { ...bgColor, alpha: 0 },
    })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: bgColor },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(outputPath);

  console.log("Generated", outputPath);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
