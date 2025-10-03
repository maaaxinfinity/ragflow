import { useEffect, useRef } from 'react';
import { useIsDarkTheme } from '@/components/theme-provider';

interface ThinkingAnimationProps {
  className?: string;
  size?: number;
  completed?: boolean; // 是否完成思考
}

export default function ThinkingAnimation({
  className = '',
  size = 120,
  completed = false,
}: ThinkingAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const isDarkTheme = useIsDarkTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 配置参数
    const canvassize = size;
    const length = (30 * size) / 500;
    const radius = (5.6 * size) / 500;
    const tubeRadius = (1.1 * size) / 500;
    const pi2 = Math.PI * 2;
    const segments = 200;

    // 动画状态
    let rotatevalue = 0.035;
    let acceleration = 0;
    let animatestep = 0;
    let meshRotationX = 0;
    let groupRotationY = 0;
    let groupPositionZ = 0;

    // 2D 投影设置
    const cameraZ = (150 * size) / 500;
    const fov = 65;
    const perspective = canvassize / (2 * Math.tan((fov * Math.PI) / 360));

    // 设置 Canvas
    canvas.width = canvassize;
    canvas.height = canvassize;
    const centerX = canvassize / 2;
    const centerY = canvassize / 2;

    // 曲线函数
    function getPointOnCurve(percent: number) {
      let x = length * Math.sin(pi2 * percent);
      let y = radius * Math.cos(pi2 * 3 * percent);
      let z, t;

      t = (percent % 0.25) / 0.25;
      t = percent % 0.25 - (2 * (1 - t) * t * -0.0185 + t * t * 0.25);
      if (
        Math.floor(percent / 0.25) === 0 ||
        Math.floor(percent / 0.25) === 2
      ) {
        t *= -1;
      }
      z = radius * Math.sin(pi2 * 2 * (percent - t));
      return { x, y, z };
    }

    // 3D点投影到2D平面
    function project(point: { x: number; y: number; z: number }) {
      const scale = perspective / (perspective + point.z + cameraZ);
      return {
        x: centerX + point.x * scale,
        y: centerY + point.y * scale,
        scale: scale,
      };
    }

    // 旋转点
    function rotate(
      point: { x: number; y: number; z: number },
      rotX: number,
      rotY: number,
    ) {
      // Rotate around X axis
      let y = point.y * Math.cos(rotX) - point.z * Math.sin(rotX);
      let z = point.y * Math.sin(rotX) + point.z * Math.cos(rotX);
      point.y = y;
      point.z = z;
      // Rotate around Y axis
      let x = point.x * Math.cos(rotY) - point.z * Math.sin(rotY);
      z = point.x * Math.sin(rotY) + point.z * Math.cos(rotY);
      point.x = x;
      point.z = z;
      return point;
    }

    // 缓动函数
    function easing(t: number, b: number, c: number, d: number) {
      if ((t /= d / 2) < 1) return (c / 2) * t * t + b;
      return (c / 2) * ((t -= 2) * t * t + 2) + b;
    }

    // 主绘制函数
    function draw() {
      // 1. 更新状态 - 根据 completed 自动控制
      if (completed) {
        // 完成时，自动播放到结束
        animatestep = Math.min(240, animatestep + 2);
      } else {
        // 未完成时，保持在初始状态循环
        animatestep = 0;
      }
      acceleration = easing(animatestep, 0, 1, 240);
      meshRotationX += rotatevalue + acceleration;

      let progress;
      let meshOpacity = 1;
      let ringOpacity = 0;
      let ringScale = 0.9;

      if (acceleration > 0.35) {
        progress = (acceleration - 0.35) / 0.65;
        groupRotationY = (-Math.PI / 2) * progress;
        groupPositionZ = 50 * (size / 500) * progress;
        progress = Math.max(0, (acceleration - 0.97) / 0.03);
        meshOpacity = 1 - progress;
        ringOpacity = progress;
        ringScale = 0.9 + 0.1 * progress;
      } else {
        groupRotationY = 0;
        groupPositionZ = 0;
      }

      // 2. 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 使用主题色
      const shadowColor = isDarkTheme ? '#8b5a3c' : '#d1684e';
      const tubeColor = isDarkTheme ? '#e0e0e0' : '#ffffff';

      // 3. 绘制伪阴影
      ctx.fillStyle = shadowColor;
      for (let i = 0; i < 10; i++) {
        ctx.globalAlpha = 0.13;
        let z = -2.5 + i * 0.5;
        let shadowPoint = { x: 0, y: 0, z: z };
        shadowPoint.z += groupPositionZ;
        let p = project(shadowPoint);
        if (p.scale > 0) {
          ctx.fillRect(
            p.x - ((length * 2 + 1) / 2) * p.scale,
            p.y - ((radius * 3) / 2) * p.scale,
            (length * 2 + 1) * p.scale,
            (radius * 3) * p.scale,
          );
        }
      }

      ctx.globalAlpha = 1.0;

      // 4. 绘制管状物
      if (meshOpacity > 0) {
        ctx.globalAlpha = meshOpacity;
        ctx.strokeStyle = tubeColor;
        ctx.lineWidth = tubeRadius * 2;

        let points = [];
        for (let i = 0; i <= segments; i++) {
          let percent = i / segments;
          let p3d = getPointOnCurve(percent);

          p3d = rotate(p3d, meshRotationX, 0);
          p3d = rotate(p3d, 0, groupRotationY);
          p3d.z += groupPositionZ;

          points.push(project(p3d));
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }

      // 5. 绘制环和覆盖层
      if (ringOpacity > 0) {
        ctx.globalAlpha = ringOpacity;

        let coverPoint = { x: length + 1, y: 0, z: 0 };
        coverPoint = rotate(coverPoint, 0, groupRotationY);
        coverPoint.z += groupPositionZ;
        let pCover = project(coverPoint);

        // 绘制覆盖层
        ctx.fillStyle = shadowColor;
        ctx.save();
        ctx.translate(pCover.x, pCover.y);
        ctx.scale(pCover.scale, pCover.scale);
        ctx.fillRect(-25 * (size / 500), -7.5 * (size / 500), 50 * (size / 500), 15 * (size / 500));
        ctx.restore();

        // 绘制圆环
        ctx.strokeStyle = tubeColor;
        ctx.lineWidth = (5.55 - 4.3) * pCover.scale * ringScale;
        ctx.beginPath();
        ctx.arc(
          pCover.x,
          pCover.y,
          (4.3 + (5.55 - 4.3) / 2) * pCover.scale * ringScale,
          0,
          pi2,
        );
        ctx.stroke();
      }

      ctx.globalAlpha = 1.0;
    }

    // 启动动画循环
    function animate() {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    // 清理函数
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size, isDarkTheme, completed]);

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
