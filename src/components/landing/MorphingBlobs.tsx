import { useEffect, useRef } from 'react';

export function MorphingBlobs() {
  const blob1Ref = useRef<SVGPathElement>(null);
  const blob2Ref = useRef<SVGPathElement>(null);
  const blob3Ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const blobs = [blob1Ref.current, blob2Ref.current, blob3Ref.current];
    const animations: number[] = [];

    const blobPaths = [
      [
        'M440,320Q430,390,370,420Q310,450,240,440Q170,430,120,380Q70,330,80,260Q90,190,140,140Q190,90,260,80Q330,70,390,110Q450,150,450,230Q450,310,440,320Z',
        'M420,300Q380,350,340,390Q300,430,240,430Q180,430,130,390Q80,350,70,280Q60,210,100,150Q140,90,210,70Q280,50,340,90Q400,130,430,200Q460,270,420,300Z',
        'M450,310Q420,370,360,400Q300,430,230,420Q160,410,110,360Q60,310,70,240Q80,170,130,120Q180,70,250,60Q320,50,380,100Q440,150,460,220Q480,290,450,310Z',
      ],
      [
        'M420,280Q370,320,330,360Q290,400,230,400Q170,400,120,360Q70,320,60,260Q50,200,90,150Q130,100,190,70Q250,40,310,80Q370,120,410,180Q450,240,420,280Z',
        'M440,300Q400,360,340,390Q280,420,220,410Q160,400,110,350Q60,300,70,240Q80,180,120,130Q160,80,230,60Q300,40,360,90Q420,140,450,210Q480,280,440,300Z',
        'M430,290Q380,340,330,380Q280,420,220,420Q160,420,110,370Q60,320,60,250Q60,180,110,130Q160,80,230,60Q300,40,360,90Q420,140,450,210Q480,280,430,290Z',
      ],
      [
        'M410,290Q360,340,310,380Q260,420,200,410Q140,400,100,350Q60,300,70,240Q80,180,120,130Q160,80,220,60Q280,40,340,80Q400,120,430,190Q460,260,410,290Z',
        'M430,300Q390,360,330,390Q270,420,210,410Q150,400,100,350Q50,300,60,240Q70,180,110,130Q150,80,220,50Q290,20,350,70Q410,120,440,190Q470,260,430,300Z',
        'M420,280Q370,330,320,370Q270,410,210,410Q150,410,100,360Q50,310,60,250Q70,190,110,140Q150,90,210,60Q270,30,330,70Q390,110,430,180Q470,250,420,280Z',
      ],
    ];

    blobs.forEach((blob, blobIndex) => {
      if (!blob) return;

      let pathIndex = 0;
      const paths = blobPaths[blobIndex];

      const animate = () => {
        pathIndex = (pathIndex + 1) % paths.length;
        blob.style.transition = 'd 4s ease-in-out';
        blob.setAttribute('d', paths[pathIndex]);
      };

      // Initial path
      blob.setAttribute('d', paths[0]);

      // Start animation loop
      const interval = setInterval(animate, 4000);
      animations.push(interval as unknown as number);
    });

    return () => {
      animations.forEach((interval) => clearInterval(interval));
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute w-[800px] h-[800px] -top-40 -left-40 opacity-30"
        viewBox="0 0 500 500"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="blob1-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(187, 85%, 53%)" />
            <stop offset="100%" stopColor="hsl(210, 85%, 60%)" />
          </linearGradient>
        </defs>
        <path
          ref={blob1Ref}
          fill="url(#blob1-gradient)"
          className="animate-blob-morph"
          style={{ 
            filter: 'blur(40px)',
            transition: 'd 4s ease-in-out',
          }}
        />
      </svg>

      <svg
        className="absolute w-[600px] h-[600px] top-1/4 -right-20 opacity-20"
        viewBox="0 0 500 500"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="blob2-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(280, 85%, 60%)" />
            <stop offset="100%" stopColor="hsl(320, 85%, 55%)" />
          </linearGradient>
        </defs>
        <path
          ref={blob2Ref}
          fill="url(#blob2-gradient)"
          style={{ 
            filter: 'blur(50px)',
            transition: 'd 5s ease-in-out',
          }}
        />
      </svg>

      <svg
        className="absolute w-[500px] h-[500px] -bottom-20 left-1/3 opacity-25"
        viewBox="0 0 500 500"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="blob3-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(30, 85%, 55%)" />
            <stop offset="100%" stopColor="hsl(45, 85%, 60%)" />
          </linearGradient>
        </defs>
        <path
          ref={blob3Ref}
          fill="url(#blob3-gradient)"
          style={{ 
            filter: 'blur(45px)',
            transition: 'd 6s ease-in-out',
          }}
        />
      </svg>
    </div>
  );
}
