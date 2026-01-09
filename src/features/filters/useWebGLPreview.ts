import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const fragmentShaderSource = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_grayscale_amount;
uniform float u_brightness_amount;
uniform float u_contrast_amount;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);

  // grayscale
  if (u_grayscale_amount > 0.0) {
    float g = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(g), u_grayscale_amount);
  }

  // brightness
  color.rgb = clamp(color.rgb + u_brightness_amount, 0.0, 1.0);

  // contrast
  if (u_contrast_amount != 0.0) {
    float c = 1.0 + u_contrast_amount;
    color.rgb = clamp((color.rgb - 0.5) * c + 0.5, 0.0, 1.0);
  }

  gl_FragColor = color;
}
`;

type ShaderProgram = {
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
  texture: WebGLTexture;
  attrib: {
    position: number;
    texCoord: number;
  };
  uniform: {
    texture: WebGLUniformLocation | null;
    grayscale_amount: WebGLUniformLocation | null;
    brightness_amount: WebGLUniformLocation | null;
    contrast_amount: WebGLUniformLocation | null;
  };
};

type GLResources = {
  gl: WebGLRenderingContext;
  program: ShaderProgram;
  destroy: () => void;
};

type Args = {
  videoEl: HTMLVideoElement | null;
  enabled: boolean;
  filters: {
    grayscale: { enabled: boolean; amount: number };
    brightness: { enabled: boolean; amount: number };
    contrast: { enabled: boolean; amount: number };
  };
  videoSize: { width: number; height: number } | null;
};

export type WebGLPreviewResult = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: {
    supported: boolean;
    error: string | null;
  };
};

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function initGL(canvas: HTMLCanvasElement): GLResources | null {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const programObj = createProgram(
    gl,
    vertexShaderSource,
    fragmentShaderSource
  );
  if (!programObj) return null;

  const program = programObj;
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!positionBuffer || !texCoordBuffer || !texture) return null;

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');

  const textureLocation = gl.getUniformLocation(program, 'u_texture');
  const grayscaleAmountLocation = gl.getUniformLocation(
    program,
    'u_grayscale_amount'
  );
  const brightnessAmountLocation = gl.getUniformLocation(
    program,
    'u_brightness_amount'
  );
  const contrastAmountLocation = gl.getUniformLocation(
    program,
    'u_contrast_amount'
  );

  const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const tex = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, tex, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const destroy = () => {
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
  };

  return {
    gl,
    program: {
      program,
      positionBuffer,
      texCoordBuffer,
      texture,
      attrib: {
        position: positionLocation,
        texCoord: texCoordLocation,
      },
      uniform: {
        texture: textureLocation,
        grayscale_amount: grayscaleAmountLocation,
        brightness_amount: brightnessAmountLocation,
        contrast_amount: contrastAmountLocation,
      },
    },
    destroy,
  };
}

export function useWebGLPreview(args: Args): WebGLPreviewResult {
  const videoEl = args.videoEl;
  const enabled = args.enabled;
  const filters = args.filters;
  const videoSize = args.videoSize;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resourcesRef = useRef<GLResources | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const enabledRef = useRef(enabled);
  const filtersRef = useRef(filters);

  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const stopRender = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopRender();
      const resources = resourcesRef.current;
      if (resources) {
        resources.destroy();
        resourcesRef.current = null;
      }
    }
  }, [enabled, stopRender]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoEl || !enabled) return undefined;

    let resources = resourcesRef.current;
    if (!resources) {
      resources = initGL(canvas);
      if (!resources) {
        setSupported(false);
        setError('브라우저에서 WebGL을 사용할 수 없어요.');
        return undefined;
      }
      resourcesRef.current = resources;
      setSupported(true);
      setError(null);
    }

    const { gl, program } = resources;

    const render = () => {
      if (!enabledRef.current) return;
      if (!videoEl || videoEl.readyState < 2) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      const displayWidth =
        videoSize?.width || videoEl.clientWidth || videoEl.videoWidth || 1;
      const displayHeight =
        videoSize?.height || videoEl.clientHeight || videoEl.videoHeight || 1;
      const width = videoEl.videoWidth || displayWidth;
      const height = videoEl.videoHeight || displayHeight;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      gl.useProgram(program.program);
      gl.bindTexture(gl.TEXTURE_2D, program.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        videoEl
      );

      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error('WebGL texture error:', error);
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      gl.uniform1i(program.uniform.texture, 0);
      gl.uniform1f(
        program.uniform.grayscale_amount,
        filtersRef.current.grayscale.enabled
          ? filtersRef.current.grayscale.amount
          : 0
      );
      gl.uniform1f(
        program.uniform.brightness_amount,
        filtersRef.current.brightness.enabled
          ? filtersRef.current.brightness.amount
          : 0
      );
      gl.uniform1f(
        program.uniform.contrast_amount,
        filtersRef.current.contrast.enabled
          ? filtersRef.current.contrast.amount
          : 0
      );

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    const resizeObserver = new ResizeObserver(() => {});
    resizeObserver.observe(videoEl);
    resizeObserverRef.current = resizeObserver;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setError('WebGL 컨텍스트가 해제됐어요. 필터를 다시 켜주세요.');
      stopRender();

      resourcesRef.current?.destroy();
      resourcesRef.current = null;
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, {
      passive: false,
    });

    return () => {
      stopRender();
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
    };
  }, [videoEl, enabled, videoSize]);

  useEffect(
    () => () => {
      stopRender();
      resizeObserverRef.current?.disconnect();

      const resources = resourcesRef.current;
      if (resources) {
        resources.destroy();
        resourcesRef.current = null;
      }
    },
    [stopRender]
  );

  return { canvasRef, status: { supported, error } };
}
