"use client";
// this is all lifted from https://github.com/signal-noise/react-shader-canvas/blob/master/src/index.js
// with some edits

// @ts-ignore
import glslCanvas from "glslCanvas";
import { useEffect, useRef } from "react";

let supported: boolean | undefined = undefined;

export const isWebGlSupported = () => {
  if (typeof document === "undefined" || typeof window === "undefined")
    return false;
  if (supported === undefined) {
    supported = !!document.createElement("canvas").getContext("webgl");
  }
  return supported;
};

export const getDevicePixelRatio = () => {
  if (typeof document === "undefined") return 1;
  return devicePixelRatio || 1;
};

interface ShaderCanvasProps
  extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  width: number;
  height: number;
  fragShader: string;
  vertShader?: string;
  uniforms?: { [key: string]: any };
  superSample: number;
  style?: React.CSSProperties;
}

const ShaderCanvas: React.FC<ShaderCanvasProps> = ({
  width,
  height,
  fragShader,
  vertShader,
  uniforms,
  superSample,
  style,
  ...props
}) => {
  const canvas = useRef<any>();
  const sandbox = useRef<any>();
  const webGlSupported = isWebGlSupported();
  const pixelDensity = getDevicePixelRatio();

  // Spawn the glslCanvas
  useEffect(() => {
    if (!webGlSupported && glslCanvas) return;
    sandbox.current = new glslCanvas(canvas.current);
  }, [webGlSupported]);

  // Load the shader if it changes
  useEffect(() => {
    if (!webGlSupported && glslCanvas) return;
    sandbox.current?.load(fragShader, vertShader);
  }, [webGlSupported, fragShader, vertShader]);

  //Set the uniforms if the shader or uniforms change
  useEffect(() => {
    if (!webGlSupported && glslCanvas) return;
    if (!sandbox.current) return;

    // Set the pixel size based on supersample
    sandbox.current.realToCSSPixels = pixelDensity * superSample;

    if (!uniforms) return;
    sandbox.current.setUniforms(uniforms);
  }, [
    pixelDensity,
    webGlSupported,
    fragShader,
    vertShader,
    uniforms,
    superSample,
  ]);

  return (
    <canvas
      {...props}
      ref={canvas}
      width={width * pixelDensity * superSample}
      height={height * pixelDensity * superSample}
      style={{
        ...style,
        width: `100vw`,
        height: `100vh`,
      }}
    />
  );
};

export default ShaderCanvas;
