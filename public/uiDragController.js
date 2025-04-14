import * as THREE from 'three';

export class UIDragController {
    constructor(eventController) {
        // 부모 이벤트 컨트롤러 참조
        this.eventController = eventController;
        
        // 단축 참조 설정
        this.uiController = eventController.uiController;
        this.canvas = eventController.canvas;
        this.modelManager = eventController.modelManager;
        this.collisionManager = eventController.collisionManager;
        this.raycaster = eventController.raycaster;
        this.mouse = eventController.mouse;
        this.camera = eventController.camera;
        this.controls = eventController.controls;
        this.distanceController = null; // 나중에 설정됨
        
        // 드래그 관련 변수
        this.isDragging = false;
        this.dragStartPosition = new THREE.Vector3();
        this.previousPosition = new THREE.Vector3();
        this.mouseStartPosition = new THREE.Vector2();
        
        // 측정 모드 관련 변수
        this.disableDragWhileMeasuring = false;
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 캔버스 드래그 이벤트
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // 드래그 이벤트가 캔버스 외부로 나갈 경우에도 처리
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // 거리 컨트롤러 참조 설정 (순환 참조 방지를 위해 이벤트 리스너 설정 후 설정)
        this.distanceController = this.eventController.distanceController;
    }
    
    // 마우스 다운 처리 (드래그 시작)
    handleMouseDown(event) {
        // 측정 모드 중에는 드래그 비활성화
        if (this.disableDragWhileMeasuring) return;
        
        // 마우스 좌표 정규화
        this.uiController.updateMouseCoordinates(event);
        
        // 레이캐스터 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 선택된 객체 확인
        const selectedObject = this.modelManager.getSelectedObject();
        const selectedModelId = this.modelManager.getSelectedModelId();
        
        if (!selectedObject || selectedModelId === null) return;
        
        // 현재 선택된 모델 찾기
        const model = this.modelManager.getModel(selectedModelId);
        if (!model) return;
        
        // 선택 메시나 모든 메시를 대상으로 레이캐스트
        const models = this.modelManager.getAllModels();
        const selectionMeshes = models.map(m => m.selectionMesh);
        const allMeshObjects = [];
        
        models.forEach(m => {
            if (m.originalModel) {
                m.originalModel.traverse(child => {
                    if (child.isMesh) {
                        allMeshObjects.push(child);
                    }
                });
            }
        });
        
        // 모든 가능한 객체로 레이캐스트
        const potentialTargets = [...selectionMeshes, ...allMeshObjects, ...models.map(m => m.root)];
        const intersects = this.raycaster.intersectObjects(potentialTargets, true);
        
        let canDrag = false;
        
        // 교차 객체 확인
        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            
            // 객체나 그 부모가 현재 선택된 모델에 속하는지 확인
            let currentObj = hitObject;
            while (currentObj) {
                if (currentObj.userData && currentObj.userData.modelId === selectedModelId) {
                    canDrag = true;
                    break;
                }
                currentObj = currentObj.parent;
            }
        }
        
        // 어떤 방식으로든 선택된 모델을 찾았으면 드래그 시작
        if (canDrag || selectedModelId !== null) {
            // 드래그 시작 상태 설정
            this.isDragging = true;
            this.controls.enabled = false;
            
            // 시작 위치 저장
            this.dragStartPosition.copy(selectedObject.position);
            this.previousPosition.copy(selectedObject.position);
            this.mouseStartPosition.set(this.mouse.x, this.mouse.y);
        }
    }
    
    // 마우스 이동 처리 (드래그 중)
    handleMouseMove(event) {
        if (!this.isDragging) return;
        
        const selectedObject = this.modelManager.getSelectedObject();
        if (!selectedObject) return;
        
        // 마우스 좌표 정규화
        this.uiController.updateMouseCoordinates(event);
        
        // 카메라 방향을 고려하여 이동 평면 계산
        const planeNormal = new THREE.Vector3(0, 1, 0); // Y축 고정 (바닥 평면)
        const plane = new THREE.Plane(planeNormal, 0);
        
        // 이전 위치와 현재 위치에 대한 레이 캐스팅
        const raycaster1 = new THREE.Raycaster();
        const raycaster2 = new THREE.Raycaster();
        
        raycaster1.setFromCamera(this.mouseStartPosition, this.camera);
        raycaster2.setFromCamera(this.mouse, this.camera);
        
        // 평면과의 교차점 계산
        const startPoint = new THREE.Vector3();
        const endPoint = new THREE.Vector3();

        const startIntersect = raycaster1.ray.intersectPlane(plane, startPoint);
        const endIntersect = raycaster2.ray.intersectPlane(plane, endPoint);

        if (startIntersect && endIntersect) {
            // 이동 벡터 계산
            const moveVector = endPoint.sub(startPoint);
            
            // 이전 위치 저장
            this.previousPosition.copy(selectedObject.position);
            
            // 새 위치 계산
            const newPosition = this.dragStartPosition.clone().add(moveVector);
            
            // 모델 매니저를 통해 이동 시도
            const moved = this.modelManager.moveSelectedModel(newPosition, this.previousPosition);
            
            if (moved) {
                // 위치 UI 업데이트
                this.uiController.updatePositionUI(this.modelManager.getSelectedModelId());
                this.uiController.updateDistanceUI(this.modelManager.getSelectedModelId());
                
                // 거리 계산 기준점이 표시되어 있으면 거리 선 업데이트
                if (this.distanceController && 
                    this.distanceController.referencePointVisible && 
                    this.distanceController.referencePointGroup) {
                    this.distanceController.updateDistanceLines();
                }
            }
        }
    }
    
    // 마우스 업 처리 (드래그 종료)
    handleMouseUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.controls.enabled = true;
            
            // 최종 충돌 확인
            this.collisionManager.checkAllCollisions();
        }
    }
    
    // 업데이트 (매 프레임 호출)
    update() {
        // 여기에 필요하다면 프레임별 업데이트 로직 추가
    }
}