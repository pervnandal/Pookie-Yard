import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * ThreeUI <SylvaLivingWorldScene variant="living-green" />
 * Procedural moss-root world with pale flowers, ferns, drifting pollen,
 * scan-light entrance reveal, pointer parallax, and a landing butterfly.
 */
export function SylvaLivingWorldScene({ variant = 'living-green', className = '', style = {} }) {
    const mountRef = useRef(null);

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        let width = container.clientWidth || window.innerWidth;
        let height = container.clientHeight || window.innerHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x060d09);
        scene.fog = new THREE.FogExp2(0x07120c, 0.085);

        const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
        camera.position.set(0, 0.6, 6.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);

        // 1. Lighting: Canopy sunbeam, emerald bounce light, and sweeping scan-light
        const ambientLight = new THREE.AmbientLight(0x1f3d2b, 1.4);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xd9f5c4, 2.6);
        sunLight.position.set(3, 6, 4);
        scene.add(sunLight);

        const scanLight = new THREE.PointLight(0x88ffaa, 3.5, 9);
        scanLight.position.set(-4, 1.5, 2);
        scene.add(scanLight);

        // 2. Procedural Moss-Root Boughs (Twisted Organic Tubes)
        const createRootCurve = (yOffset, zOffset, twist) => {
            const pts = [];
            for (let i = 0; i <= 10; i++) {
                const t = (i / 10) * 2 - 1;
                const x = t * 5.5;
                const y = yOffset + Math.sin(t * Math.PI * 1.3 + twist) * 0.85 - t * 0.3;
                const z = zOffset + Math.cos(t * Math.PI + twist) * 0.7;
                pts.push(new THREE.Vector3(x, y, z));
            }
            return new THREE.CatmullRomCurve3(pts);
        };

        const mossMat = new THREE.MeshStandardMaterial({
            color: 0x244c30,
            roughness: 0.88,
            metalness: 0.05,
            emissive: 0x091c10,
            emissiveIntensity: 0.4
        });

        const mainCurve = createRootCurve(-0.4, 0, 0.2);
        const mainBoughGeo = new THREE.TubeGeometry(mainCurve, 72, 0.42, 18, false);
        const mainBough = new THREE.Mesh(mainBoughGeo, mossMat);
        worldGroup.add(mainBough);

        const secondaryCurve = createRootCurve(-1.2, -1.1, 1.8);
        const secBoughGeo = new THREE.TubeGeometry(secondaryCurve, 64, 0.28, 14, false);
        const secBough = new THREE.Mesh(secBoughGeo, mossMat);
        worldGroup.add(secBough);

        // 3. Instanced Moss Tufts & Ferns along the Bough
        const fernGeo = new THREE.ConeGeometry(0.08, 0.45, 5);
        fernGeo.translate(0, 0.22, 0);
        const fernMat = new THREE.MeshStandardMaterial({
            color: 0x4f8a5b,
            roughness: 0.65,
            emissive: 0x132a19,
            emissiveIntensity: 0.3
        });
        const fernCount = 180;
        const fernInstanced = new THREE.InstancedMesh(fernGeo, fernMat, fernCount);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < fernCount; i++) {
            const t = (i / fernCount) * 0.88 + 0.06;
            const pt = mainCurve.getPointAt(t);
            const angle = (i * 137.5) * (Math.PI / 180);
            dummy.position.set(
                pt.x + (Math.random() - 0.5) * 0.35,
                pt.y + Math.cos(angle) * 0.36,
                pt.z + Math.sin(angle) * 0.36
            );
            dummy.rotation.set(
                (Math.random() - 0.5) * 0.8,
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * 0.9
            );
            const s = 0.6 + Math.random() * 1.1;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            fernInstanced.setMatrixAt(i, dummy.matrix);
        }
        worldGroup.add(fernInstanced);

        // 4. Pale Botanical Blossoms along the Mossy Arch
        const flowerGeo = new THREE.DodecahedronGeometry(0.09, 0);
        const flowerMat = new THREE.MeshStandardMaterial({
            color: 0xf4f1e6,
            emissive: 0xd8e2c5,
            emissiveIntensity: 0.45,
            roughness: 0.4
        });
        const flowerCount = 42;
        const flowerInstanced = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
        for (let i = 0; i < flowerCount; i++) {
            const t = (i / flowerCount) * 0.82 + 0.09;
            const pt = mainCurve.getPointAt(t);
            dummy.position.set(
                pt.x + (Math.random() - 0.5) * 0.4,
                pt.y + 0.38 + Math.random() * 0.12,
                pt.z + (Math.random() - 0.5) * 0.4
            );
            const s = 0.7 + Math.random() * 0.8;
            dummy.scale.set(s, s * 0.7, s);
            dummy.updateMatrix();
            flowerInstanced.setMatrixAt(i, dummy.matrix);
        }
        worldGroup.add(flowerInstanced);

        // 5. Drifting Golden Pollen Particle Field
        const pollenCount = 320;
        const pollenPositions = new Float32Array(pollenCount * 3);
        for (let i = 0; i < pollenCount; i++) {
            pollenPositions[i * 3] = (Math.random() - 0.5) * 12;
            pollenPositions[i * 3 + 1] = (Math.random() - 0.5) * 7;
            pollenPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
        }
        const pollenGeo = new THREE.BufferGeometry();
        pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPositions, 3));
        const pollenMat = new THREE.PointsMaterial({
            color: 0xe9cf87,
            size: 0.055,
            transparent: true,
            opacity: 0.78,
            blending: THREE.AdditiveBlending
        });
        const pollenField = new THREE.Points(pollenGeo, pollenMat);
        scene.add(pollenField);

        // 6. Landing Butterfly with Animated Wings
        const butterflyGroup = new THREE.Group();
        const wingGeo = new THREE.PlaneGeometry(0.22, 0.28);
        wingGeo.translate(0.11, 0, 0);
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0xeef7d8,
            emissive: 0x76b884,
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92
        });
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.scale.x = -1;
        butterflyGroup.add(leftWing, rightWing);
        scene.add(butterflyGroup);

        const perchPoint = mainCurve.getPointAt(0.62);
        perchPoint.y += 0.46;

        // Pointer Parallax
        let targetX = 0;
        let targetY = 0;
        const onPointerMove = (e) => {
            targetX = (e.clientX / window.innerWidth - 0.5) * 0.7;
            targetY = (e.clientY / window.innerHeight - 0.5) * 0.45;
        };
        window.addEventListener('pointermove', onPointerMove);

        let rafId;
        const clock = new THREE.Clock();

        const animate = () => {
            rafId = requestAnimationFrame(animate);
            const t = clock.getElapsedTime();

            // Camera subtle breathing & pointer parallax
            camera.position.x += (targetX - camera.position.x) * 0.04;
            camera.position.y += (0.6 - targetY - camera.position.y) * 0.04;
            camera.lookAt(0, -0.15, 0);

            // Sweeping scan light across the moss bough
            scanLight.position.x = Math.sin(t * 0.55) * 4.5;
            scanLight.position.y = 0.8 + Math.cos(t * 0.4) * 0.8;

            // Drifting pollen motion
            const posAttr = pollenGeo.attributes.position;
            for (let i = 0; i < pollenCount; i++) {
                let y = posAttr.getY(i) + 0.0035;
                let x = posAttr.getX(i) + Math.sin(t * 0.8 + i) * 0.0018;
                if (y > 3.5) y = -3.5;
                posAttr.setXY(i, x, y);
            }
            posAttr.needsUpdate = true;

            // Butterfly flight & perching cycle
            const flightCycle = (Math.sin(t * 0.35) + 1) * 0.5;
            if (flightCycle > 0.35) {
                butterflyGroup.position.set(
                    perchPoint.x + Math.sin(t * 1.4) * 1.2 * (flightCycle - 0.35),
                    perchPoint.y + Math.abs(Math.cos(t * 1.1)) * 0.9 * (flightCycle - 0.35),
                    perchPoint.z + Math.sin(t * 0.9) * 0.6 * (flightCycle - 0.35)
                );
                const flap = Math.sin(t * 18) * 0.95;
                leftWing.rotation.y = flap;
                rightWing.rotation.y = -flap;
            } else {
                butterflyGroup.position.lerp(perchPoint, 0.08);
                const restFlap = Math.sin(t * 2.2) * 0.25 + 0.4;
                leftWing.rotation.y = restFlap;
                rightWing.rotation.y = -restFlap;
            }

            renderer.render(scene, camera);
        };

        animate();

        const onResize = () => {
            if (!container) return;
            width = container.clientWidth || window.innerWidth;
            height = container.clientHeight || window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
        };
    }, [variant]);

    return (
        <div className={`shader-frame relative w-full h-full overflow-hidden ${className}`} style={style}>
            <div ref={mountRef} className="w-full h-full" />
        </div>
    );
}

export default SylvaLivingWorldScene;