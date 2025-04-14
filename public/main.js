import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import CollisionManager from './collision.js';
import { ModelManager } from './modelManager.js';
import { UIController } from './uiController.js';
import { GridSystem } from './gridSystem.js';
import { FloorPlanSystem } from './FloorPlanSystem.js';

// 전역 변수
let scene, camera, renderer, controls;
let raycaster, mouse;
let clock;
let collisionManager;
let modelManager;
let uiController;
let gridSystem;
let floorPlanSystem;

// 초기화
function init() {
    // 씬 설정
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);

    // 카메라 설정
    camera = new THREE.PerspectiveCamera(
        75,                             // 시야각(FOV)
        window.innerWidth / window.innerHeight, // 종횡비
        0.1,                           // near 클리핑 평면 (가까운 절단면)
        1000                           // far 클리핑 평면 (먼 절단면) - 멀리 있는 객체도 보이도록 수정
    );
    camera.position.set(0, 2, 5);
    camera.updateProjectionMatrix();

    // 렌더러 설정
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 그림자 품질 향상
    renderer.logarithmicDepthBuffer = true; // 원거리에서의 z-fighting 방지

    // 렌더러 추가 고급 설정
    renderer.sortObjects = true; // 올바른 렌더링 순서
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // HDR 효과 개선
    renderer.toneMappingExposure = 1.0; // 노출 설정

    // 정밀도 설정 - z-fighting 감소
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 너무 높은 픽셀 비율 제한
    document.body.appendChild(renderer.domElement);

    // 조명 설정
    setupLights();

    // 그리드 시스템 초기화
    gridSystem = new GridSystem(scene);
    gridSystem.createGrid({
        mapResolution: 0.05,   // 배율: 5cm/px (SLAM map resolution)
        gridCellWidth: 1.0,    // 셀 가로 크기: 1m
        gridCellDepth: 1.0,    // 셀 세로 크기: 1m
        gridWidthCount: 10,    // 가로 10개 셀
        gridDepthCount: 10     // 세로 10개 셀
    });

    // 카메라 위치 조정
    camera.position.set(0, 5, 12); // 그리드를 더 잘 볼 수 있도록 조정
    camera.lookAt(0, 0, 0);

    // 원점(중심점) 표시기 생성
    const originIndicator = createOriginIndicator();
    scene.add(originIndicator);

    // 컨트롤 설정
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2; // 90도까지만 회전 가능 (바닥면까지)
    controls.minPolarAngle = 0; // 위쪽으로는 제한 없음
    controls.maxDistance = 500; // 최대 줌 아웃 거리 설정
    controls.minDistance = 1;   // 최소 줌 인 거리 설정

    // 레이캐스터
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 시계
    clock = new THREE.Clock();

    // 충돌 관리자 초기화
    collisionManager = new CollisionManager();
    collisionManager.setCollisionCallback(handleCollisionChange);

    // 모델 매니저 초기화
    modelManager = new ModelManager(scene, collisionManager);
    modelManager.setGridSystem(gridSystem); // 그리드 시스템 참조 전달

    // UI 컨트롤러 초기화
    uiController = new UIController(
        renderer.domElement,
        modelManager,
        collisionManager,
        raycaster,
        mouse,
        camera,
        controls,
        gridSystem // 그리드 시스템 참조 전달
    );

    // 바닥 도형 시스템 초기화
    floorPlanSystem = new FloorPlanSystem(scene, gridSystem);
    
    // 이벤트 컨트롤러에 바닥 도형 시스템 설정
    uiController.eventController.setFloorPlanSystem(floorPlanSystem);

    // 창 리사이즈 이벤트
    window.addEventListener('resize', onWindowResize);
    
    // 그리드 업데이트 버튼
    const updateGridButton = document.getElementById('updateGridButton');
    updateGridButton.addEventListener('click', updateGridFromUI);
   
    debugGridSystem();

    console.log("초기화 완료");
    console.log("바닥 도형 시스템 초기화 완료");
}

// 원점(중심점) 표시기 생성
function createOriginIndicator() {
    const group = new THREE.Group();
    
    // 구체
    const sphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    group.add(sphere);
    
    // X축 (빨간색)
    const xAxisGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
    xAxis.rotation.z = -Math.PI / 2;
    xAxis.position.x = 0.5;
    group.add(xAxis);
    
    // Z축 (파란색)
    const zAxisGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
    zAxis.rotation.x = Math.PI / 2;
    zAxis.position.z = 0.5;
    group.add(zAxis);
    
    // Y축 (초록색)
    const yAxisGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
    yAxis.position.y = 0.5;
    group.add(yAxis);
    
    // 텍스트 표시 (SpriteMaterial 사용)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    // Three.js 캔버스에 직접 스타일 지정 (CSS 스타일 대신)
    context.fillStyle = 'white';
    context.font = 'Bold 24px Arial';
    context.fillText('원점 (0,0,0)', 10, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, 1, 0);
    sprite.scale.set(2, 1, 1);
    group.add(sprite);
    
    return group;
}

// 조명 설정
function setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 주변광 강도 증가
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    
    // 그림자 품질 향상 및 범위 확장
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    
    scene.add(directionalLight);
    
    // 추가 조명으로 멀리 있는 객체도 잘 보이게 함
    const additionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    additionalLight.position.set(-5, 8, -5);
    scene.add(additionalLight);
}

// UI에서 그리드 설정 가져와서 업데이트
function updateGridFromUI() {
    const mapResolution = parseFloat(document.getElementById('mapResolution').value);
    const gridCellWidth = parseFloat(document.getElementById('gridCellWidth').value);
    const gridCellDepth = parseFloat(document.getElementById('gridCellDepth').value);
    const gridWidthCount = parseInt(document.getElementById('gridWidthCount').value);
    const gridDepthCount = parseInt(document.getElementById('gridDepthCount').value);
    
    const gridSettings = {
        mapResolution,
        gridCellWidth,
        gridCellDepth,
        gridWidthCount,
        gridDepthCount
    };
    
    // 그리드 업데이트
    gridSystem.updateGrid(gridSettings);
    
    // 기존 모델들의 위치 검증 및 필요시 조정
    modelManager.validateAllModelsPosition();
}

// 충돌 상태 변경 핸들러
function handleCollisionChange(hasCollision) {
    const collisionMessage = document.getElementById('collisionMessage');
    collisionMessage.style.display = hasCollision ? 'block' : 'none';
}

// 화면 크기 변경 처리
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 크기 변경 시 바닥 도형의 치수 화살표 업데이트
    if (floorPlanSystem) {
        floorPlanSystem.updateDimensionArrows();
    }
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // 컨트롤 업데이트
    controls.update();

    // 모델 매니저 업데이트 (애니메이션 등)
    modelManager.update(delta);

    // UI 컨트롤러 업데이트
    uiController.update();
    
    // 바닥 도형 시스템 업데이트
    if (floorPlanSystem) {
        floorPlanSystem.update();
    }

    // 렌더링 최적화
    optimizeRenderingForCurrentView();

    // 렌더링
    renderer.render(scene, camera);
}

function optimizeRenderingForCurrentView() {
    // 모든 모델을 가져와서 카메라와의 거리 기준으로 LOD 적용
    const models = modelManager.getAllModels();
    const cameraPosition = camera.position.clone();
    
    models.forEach(model => {
        if (!model.root) return;
        
        // 모델의 중심 위치
        const modelPosition = model.root.position.clone();
        
        // 카메라와 모델 간의 거리 계산
        const distance = cameraPosition.distanceTo(modelPosition);
        
        // 거리에 따른 최적화
        model.root.traverse(node => {
            if (node.isMesh) {
                // 매우 멀리 있는 객체는 그림자 비활성화로 성능 향상
                if (distance > 20) {
                    node.castShadow = false;
                    node.receiveShadow = false;
                } else {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
                
                // 거리에 따른 재질 품질 조정
                if (node.material) {
                    // 멀리 있는 객체는 낮은 품질로 렌더링하여 성능 향상
                    if (distance > 30) {
                        node.material.flatShading = true;
                    } else {
                        node.material.flatShading = false;
                    }
                }
            }
        });
        
        // 선택되지 않은 모델은 약간 투명하게 처리 (선택 강조 효과)
        if (model.id !== modelManager.getSelectedModelId()) {
            if (model.root.userData.originalOpacity === undefined) {
                // 원래 불투명도 저장 (처음 발견 시)
                model.root.traverse(node => {
                    if (node.isMesh && node.material) {
                        if (node.userData.originalOpacity === undefined) {
                            node.userData.originalOpacity = node.material.opacity || 1.0;
                        }
                    }
                });
            }
        } else {
            // 선택된 모델은 원래 불투명도로 복원
            model.root.traverse(node => {
                if (node.isMesh && node.material && node.userData.originalOpacity !== undefined) {
                    node.material.opacity = node.userData.originalOpacity;
                }
            });
        }
    });
}

function debugGridSystem() {
    console.log("===== 그리드 시스템 디버깅 정보 =====");
    
    // 현재 그리드 설정 정보 출력
    const settings = gridSystem.getGridSettings();
    console.log("그리드 설정:", settings);
    
    // 픽셀 <-> 미터 변환 테스트
    console.log("변환 테스트:");
    console.log("100픽셀 = ", gridSystem.pixelsToUnits(100), "미터");
    console.log("1미터 = ", gridSystem.unitsToPixels(1), "픽셀");
    
    // 그리드 경계 정보
    console.log("그리드 경계:", gridSystem.boundaryBox);
    
    // 전체 그리드 크기 (Three.js 단위)
    const totalSize = gridSystem.getTotalGridSize();
    console.log("실제 그리드 크기(미터):", totalSize.width, "×", totalSize.depth);
    
    // Three.js 씬에서의 실제 크기
    const gridMeshSize = gridSystem.gridMesh.geometry.parameters;
    console.log("그리드 메시 크기(Three.js):", gridMeshSize.width, "×", gridMeshSize.height);
    
    // 셀 크기 확인
    const cellWidth = settings.gridCellWidth;
    const cellDepth = settings.gridCellDepth;
    console.log("셀 크기(미터):", cellWidth, "×", cellDepth);
    
    console.log("===== 디버깅 정보 끝 =====");
}

// 초기화 시작
init();
animate();