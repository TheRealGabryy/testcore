import * as core from '@diffusionstudio/core';

export const settings: core.CompositionSettings = {
  background: '#76b7f5',
};

export async function main(composition: core.Composition) {
  const font = await core.loadFont({
    family: 'Geologica',
    weight: '800',
  });

  core.env.experimental_timeBase = 30;
  core.env.experimental_canonicalTimeBase = 48_000;

  const sources = await Promise.all([
    core.Source.from<core.VideoSource>('/bbb_1080p_30fps.mp4'),
    core.Source.from<core.ImageSource>('/lenna.png'),
    core.Source.from<core.AudioSource>('/harvard.MP3'),
    core.Source.from<core.CaptionSource>('/captions.json'),
    core.Source.from<core.AudioSource>('/file_example_MP3_1MG.mp3'),
    core.Source.from<core.ImageSource>('/parrot.jpg')
  ]);

  const mask = new core.RectangleMask({
    x: 1920 / 2,
    y: 1080 / 2,
    width: 1080,
    height: 1080,
    radius: 100,
  });

  const videoClip = new core.VideoClip(sources[0], {
    position: 'center',
    mask,
    height: '100%',
    animations: [
      {
        key: 'scale',
        frames: [
          { time: 0, value: 0.5 },
          { time: 2, value: 1 },
        ],
      },
      {
        key: 'rotation',
        frames: [
          { time: 0, value: 0 },
          { time: 2, value: 720 },
        ],
      },
      {
        key: 'opacity',
        frames: [
          { time: 0, value: 100 },
          { time: 1, value: 80 },
          { time: 2, value: 100 },
        ],
      }
    ],
    range: [0.8, 18],
    delay: 1,
  })

  const videoLayer = new core.Layer();
  await composition.add(videoLayer);
  await videoLayer.add(videoClip);

  const imageClip = new core.ImageClip(sources[1], {
    position: 'center',
    height: 600,
    duration: 6,
    effects: [
      {
        type: 'contrast',
        value: 60,
      },
      {
        type: 'sepia',
        value: 100,
      },
      {
        type: 'drop-shadow',
        value: {
          offsetX: -9,
          offsetY: 9,
          blur: 3,
          color: '#e81',
        },
      },
    ],
    animations: [
      {
        key: 'translateX',
        frames: [
          { time: 0, value: -1000 },
          { time: 2, value: 1000 },
          { time: 4, value: 0 }
        ],
      },
    ]
  });

  const imageLayer = new core.Layer();
  await composition.add(imageLayer);
  await imageLayer.add(imageClip);

  const audioClip = new core.AudioClip(sources[2]);

  const audioLayer = new core.Layer();
  await composition.add(audioLayer);
  await audioLayer.sequential();
  await audioLayer.add(audioClip);
  try { await audioClip.removeSilences(); } catch { /* optional */ }

  const captionLayer = new core.Layer();
  await composition.add(captionLayer);
  const captionClip = new core.CaptionClip(sources[3]);
  await captionLayer.add(captionClip);

  const textLayer0 = new core.Layer();
  await composition.add(textLayer0);
  await textLayer0.add(new core.TextClip({
    text: "Basic text in \nFlashFX",
    align: 'center',
    baseline: 'middle',
    fontSize: 14,
    strokes: [{
      width: 3,
      color: '#000000',
    }],
    x: '50%',
    y: '15%',
    rotation: 45,
  }));

  const textLayer1 = new core.Layer();
  await composition.add(textLayer1);
  await textLayer1.add(
    new core.TextClip({
      align: 'center',
      baseline: 'middle',
      fontSize: 14,
      x: '75%',
      y: '40%',
      casing: 'upper',
      duration: 20,
      animations: [{
        key: 'text',
        easing: 'ease-out',
        frames: [
          { time: 0, value: '' },
          { time: 20 / 30, value: 'Animated Text' },
        ],
      }]
    })
  );

  const rectangleLayer = new core.Layer();
  await composition.add(rectangleLayer);
  await rectangleLayer.add(
    new core.RectangleClip({
      position: 'center',
      delay: 6,
      duration: 4,
      fill: '#FF0000',
      radius: 10,
      strokes: [{
        width: 2,
        color: '#000000',
      }],
      animations: [
        {
          key: 'x',
          easing: 'ease-in-out',
          frames: [
            { time: 2.6, value: 960 },
            { time: 4, value: 50 },
          ],
        },
        {
          key: 'width',
          easing: 'ease-in-out',
          frames: [
            { time: 0, value: 0 },
            { time: 2, value: 1000 },
            { time: 4, value: 60 },
          ],
        },
        {
          key: 'height',
          easing: 'ease-in-out',
          frames: [
            { time: 0, value: 0 },
            { time: 2, value: 700 },
            { time: 4, value: 40 },
          ],
        },
        {
          key: 'fill',
          frames: [
            { time: 0, value: '#FF0000' },
            { time: 4, value: '#00FF00' },
          ],
        }
      ]
    })
  )

  const circleLayer = new core.Layer();
  await composition.add(circleLayer);
  await circleLayer.add(
    new core.EllipseClip({
      position: 'center',
      x: '70%',
      fill: '#FFFF00',
      radius: 90,
      blendMode: 'screen',
    })
  );

  const textLayer2 = new core.Layer();
  await composition.add(textLayer2);
  await textLayer2.add(
    new core.TextClip({
      text: `This is a Complex Text`,
      duration: 12,
      align: 'center',
      baseline: 'middle',
      font,
      casing: 'upper',
      fontSize: 12,
      background: {
        borderRadius: 20,
        opacity: 40,
      },
      strokes: [{
        width: 2,
        color: '#000000',
      }],
      y: '85%',
      x: '50%',
      shadows: [{
        opacity: 70,
        blur: 7,
        offsetX: 2,
        offsetY: 4,
      }],
      styles: [{
        start: 8,
        style: {
          color: '#19fa2c'
        }
      }],
    })
  )


  const audioClip1 = new core.AudioClip(sources[4], { volume: 0.2, duration: 20 });
  const audioLayer1 = new core.Layer();
  await composition.add(audioLayer1);
  await audioLayer1.add(audioClip1);

  const imageLayer2 = new core.Layer();
  await composition.add(imageLayer2);
  await imageLayer2.add(
    new core.ImageClip(sources[1], {
      height: 300,
      delay: 2,
      duration: 3,
      transition: {
        duration: 3,
        type: 'dissolve',
      }
    })
  )

  await imageLayer2.add(
    new core.ImageClip(sources[5], {
      height: 300,
      delay: 5,
      duration: 3,
    })
  )
}
