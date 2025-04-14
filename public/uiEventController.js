import * as THREE from 'three';
import { UIDragController } from './uiDragController.js';
import { UIKeyboardController } from './uiKeyboardController.js';
import { UIDistanceController } from './uiDistanceController.js';
import { UIMeasureController } from './uiMeasureController.js';
import { UIFloorPlanController } from './UIFloorPlanController.js'; // 새 컨트롤러 import

export class UIEventController {
    constructor(uiController) {
        // 부모 UI 컨트롤러 참조
        this.uiController = uiController;
        
        // 단축 참조 설정
        this.canvas = uiController.canvas;
        this.modelManager = uiController.modelManager;
        this.collisionManager = uiController.collisionManager;
        this.raycaster = uiController.raycaster;
        this.mouse = uiController.mouse;
        this.camera = uiController.camera;
        this.controls = uiController.controls;
        this.scene = uiController.modelManager.scene;
        
        // 모드 상태
        this.isMeasuringMode = false;
        this.isFloorMoveMode = false;
        
        // 서브 컨트롤러 초기화
        this.dragController = new UIDragController(this);
        this.keyboardController = new UIKeyboardController(this);
        this.distanceController = new UIDistanceController(this);
        this.measureController = new UIMeasureController(this);
        this.floorPlanController = new UIFloorPlanController(this); // 새 컨트롤러 추가
        
        // 이벤트 설정
        this.setupEventListeners();
    }
    
    // 바닥 계획 시스템 설정
    setFloorPlanSystem(floorPlanSystem) {
        this.floorPlanSystem = floorPlanSystem;
        this.floorPlanController.setFloorPlanSystem(floorPlanSystem);
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 캔버스 클릭 이벤트
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        
        // 문서 마우스 이동
        document.addEventListener('mousemove', this.handleDocumentMouseMove.bind(this));
        
        // 오른쪽 클릭 이벤트 처리 (컨텍스트 메뉴)
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        // 거리 계산 기준점 토글 이벤트
        const referencePointToggle = document.getElementById('referencePointToggle');
        if (referencePointToggle) {
            referencePointToggle.addEventListener('change', 
                this.distanceController.handleReferencePointToggle.bind(this.distanceController));
        }
        
        // 바닥 이동 모드 토글 이벤트 처리
        const floorMoveToggle = document.getElementById('floorMoveToggle');
        if (floorMoveToggle) {
            floorMoveToggle.addEventListener('change', (event) => {
                this.isFloorMoveMode = event.target.checked;
                // 바닥 이동 모드가 활성화되면 측정 모드는 비활성화
                if (this.isFloorMoveMode && this.isMeasuringMode) {
                    const measureToggle = document.getElementById('distanceMeasureToggle');
                    if (measureToggle) measureToggle.checked = false;
                    this.setMeasuringMode(false);
                }
            });
        }
        
        // 드래그 컨트롤러에 이벤트 위임
        this.dragController.setupEventListeners();
        
        // 키보드 컨트롤러에 이벤트 위임
        this.keyboardController.setupEventListeners();
        
        // 거리 측정 컨트롤러에 이벤트 위임
        this.measureController.setupEventListeners();
        
        // 바닥 도형 컨트롤러에 이벤트 위임
        this.floorPlanController.setupEventListeners();
        
        // 마우스 이벤트 추가
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    // 오른쪽 클릭 처리 (컨텍스트 메뉴)
    handleContextMenu(event) {
        // 측정 모드에서는 측정 컨트롤러에 위임
        if (this.isMeasuringMode) {
            const handled = this.measureController.handleContextMenu(event);
            return handled;
        }
        
        // 그 외의 경우 기본 컨텍스트 메뉴 허용
        return false;
    }
    
    // 마우스 다운 처리 (우선순위에 따라 처리)
    handleMouseDown(event) {
        // 왼쪽 버튼만 처리
        if (event.button !== 0) return;
        
        // 1. 바닥 이동 모드가 활성화된 경우
        if (this.isFloorMoveMode) {
            const handled = this.floorPlanController.handleMouseDown(event);
            if (handled) return;
        }
        
        // 2. 드래그 컨트롤러에 위임
        this.dragController.handleMouseDown(event);
    }
    
    // 마우스 이동 처리
    handleMouseMove(event) {
        // 1. 바닥 이동 모드가 활성화된 경우
        if (this.isFloorMoveMode) {
            const handled = this.floorPlanController.handleMouseMove(event);
            if (handled) return;
        }
        
        // 2. 드래그 컨트롤러에 위임
        this.dragController.handleMouseMove(event);
    }
    
    // 마우스 업 처리
    handleMouseUp(event) {
        // 1. 바닥 이동 모드가 활성화된 경우
        if (this.isFloorMoveMode) {
            const handled = this.floorPlanController.handleMouseUp(event);
            if (handled) return;
        }
        
        // 2. 드래그 컨트롤러에 위임
        this.dragController.handleMouseUp(event);
    }
    
    // 캔버스 클릭 처리 - 우선순위에 따라 처리
    handleCanvasClick(event) {
        // 왼쪽 클릭만 처리 (오른쪽 클릭은 contextmenu 이벤트로 처리)
        if (event.button !== 0) return;
        
        // 1. 바닥 이동 모드가 활성화된 경우 클릭 이벤트는 바닥 이동에 사용
        if (this.isFloorMoveMode) return;
        
        // 2. 측정 모드가 활성화된 경우, 측정 컨트롤러에 이벤트 위임
        if (this.isMeasuringMode) {
            const handled = this.measureController.handleCanvasClick(event);
            if (handled) return; // 이벤트가 처리되었으면 종료
        }
        
        // 3. 드래그 중이면 클릭 이벤트 무시
        if (this.dragController.isDragging) return;

        // 4. 그 외의 경우 - 기본 모델 선택 처리
        // 마우스 좌표 정규화
        this.uiController.updateMouseCoordinates(event);

        // 레이캐스터 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 모든 메시와 선택 프록시 대상으로 레이캐스팅 수행
        const models = this.modelManager.getAllModels();
        const selectionMeshes = models.map(model => model.selectionMesh);
        const allMeshes = [];
        
        models.forEach(model => {
            model.originalModel.traverse(node => {
                if (node.isMesh) {
                    allMeshes.push(node);
                }
            });
        });

        // 모든 가능한 객체를 대상으로 레이캐스트
        const targetObjects = [...selectionMeshes, ...allMeshes];
        const intersects = this.raycaster.intersectObjects(targetObjects);

        if (intersects.length > 0) {
            // 교차 객체의 모델 ID 찾기
            const hitObject = intersects[0].object;
            
            // 직접 모델 ID 있는지 확인
            if (hitObject.userData && hitObject.userData.modelId !== undefined) {
                this.modelManager.selectModel(hitObject.userData.modelId);
                return;
            }
            
            // 부모에 모델 ID 있는지 확인
            let parent = hitObject.parent;
            while (parent) {
                if (parent.userData && parent.userData.modelId !== undefined) {
                    this.modelManager.selectModel(parent.userData.modelId);
                    return;
                }
                parent = parent.parent;
            }
        } else {
            // 빈 공간 클릭 시 선택 해제
            this.modelManager.clearSelection();
            
            document.querySelectorAll('.model-item').forEach(item => {
                item.classList.remove('selected');
            });
        }
    }
    
    // 문서 마우스 이동 처리 (툴팁용)
    handleDocumentMouseMove(event) {
        // 툴팁 컨트롤러에 위임
        this.uiController.tooltipController.updateTooltipPosition(event);
    }
    
    // 거리 측정 모드 설정
    setMeasuringMode(active) {
        this.isMeasuringMode = active;
        
        // 측정 모드가 활성화되면 다른 컨트롤러들의 입력 처리를 일시적으로 비활성화할 수 있음
        if (active) {
            // 키보드 이동 비활성화
            this.keyboardController.keyboardMoveEnabled = false;
            
            // 드래그 컨트롤러에도 알림
            this.dragController.disableDragWhileMeasuring = true;
            
            // 바닥 이동 모드가 활성화되어 있으면 비활성화
            if (this.isFloorMoveMode) {
                const floorMoveToggle = document.getElementById('floorMoveToggle');
                if (floorMoveToggle) floorMoveToggle.checked = false;
                this.isFloorMoveMode = false;
                if (this.floorPlanSystem) {
                    this.floorPlanSystem.setMoveMode(false);
                }
            }
        } else {
            // 다시 활성화
            this.keyboardController.keyboardMoveEnabled = true;
            this.dragController.disableDragWhileMeasuring = false;
        }
    }
    
    // 업데이트 (매 프레임 호출)
    update() {
        // 서브 컨트롤러 업데이트
        this.dragController.update();
        this.keyboardController.update();
        this.distanceController.update();
        this.measureController.update();
        this.floorPlanController.update();
    }
}