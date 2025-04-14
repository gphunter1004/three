import * as THREE from 'three';
import { UIEventController } from './uiEventController.js';
import { UIModelPanelController } from './uiModelPanelController.js';
import { UIGridSettingsController } from './uiGridSettingsController.js';
import { UITooltipController } from './uiTooltipController.js';

export class UIController {
    constructor(canvas, modelManager, collisionManager, raycaster, mouse, camera, controls, gridSystem) {
        // 기본 참조 저장
        this.canvas = canvas;
        this.modelManager = modelManager;
        this.collisionManager = collisionManager;
        this.raycaster = raycaster;
        this.mouse = mouse;
        this.camera = camera;
        this.controls = controls;
        this.gridSystem = gridSystem;
        this.scene = modelManager.scene; // scene 참조 추가
        
        // DOM 요소 참조
        this.fileInput = document.getElementById('fileInput');
        this.clearButton = document.getElementById('clearButton');
        this.modelsList = document.getElementById('modelsList');
        this.collisionToggle = document.getElementById('collisionToggle');
        this.referencePointToggle = document.getElementById('referencePointToggle'); // 기준점 토글 참조 추가
        
        // 서브 컨트롤러 초기화 (새 구조 적용)
        this.eventController = new UIEventController(this);
        this.modelPanelController = new UIModelPanelController(this);
        this.gridSettingsController = new UIGridSettingsController(this);
        this.tooltipController = new UITooltipController(this);
        
        // 초기화
        this.initialize();
    }
    
    // 초기화
    initialize() {
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 모델 매니저 콜백 설정
        this.modelManager.setCallbacks(
            this.handleModelLoaded.bind(this),
            this.handleModelSelected.bind(this),
            this.updateModelList.bind(this)
        );
        
        // 초기 그리드 설정 로드
        this.gridSettingsController.initializeGridSettingsUI();
        
        // 초기 UI 업데이트
        this.updateModelList();
        
        console.log('UI 컨트롤러 초기화 완료');
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 파일 입력 이벤트
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // 모델 전체 삭제 버튼
        this.clearButton.addEventListener('click', this.handleClearAllModels.bind(this));
        
        // 충돌 감지 토글
        this.collisionToggle.addEventListener('change', this.handleCollisionToggle.bind(this));
        
        // 그리드 설정 컨트롤러에 이벤트 위임
        this.gridSettingsController.setupEventListeners();
        
        // 나머지 이벤트는 eventController에서 관리함
    }
    
    // 파일 선택 처리
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 파일 URL 생성
        const fileURL = URL.createObjectURL(file);
        
        // 모델 로드
        this.modelManager.loadModel(fileURL, file.name);
        
        // 파일 입력 초기화
        this.fileInput.value = '';
    }
    
    // 모든 모델 지우기
    handleClearAllModels() {
        this.modelManager.clearAllModels();
    }
    
    // 충돌 감지 토글
    handleCollisionToggle() {
        this.collisionManager.setEnabled(this.collisionToggle.checked);
    }
    
    // 모델 로드 후 처리
    handleModelLoaded(model) {
        this.updateModelList();
        
        // 기준점이 표시되어 있으면 새 모델에 기준점 추가 
        // (이제 distanceController가 이 처리를 담당)
        if (this.eventController.distanceController && 
            this.eventController.distanceController.referencePointVisible) {
            this.eventController.distanceController.addReferencePointToModel(model);
        }
    }
    
    // 모델 선택 처리
    handleModelSelected(modelId) {
        this.modelPanelController.updateModelSelection(modelId);
        
        // 기준점이 표시되어 있으면 거리 선 스타일 업데이트
        // (이제 distanceController가 이 처리를 담당)
        if (this.eventController.distanceController && 
            this.eventController.distanceController.referencePointVisible) {
            this.eventController.distanceController.updateDistanceLines();
        }
    }
    
    // 모델 목록 업데이트
    updateModelList() {
        this.modelPanelController.updateModelListUI();
    }
    
    // 위치 UI 업데이트
    updatePositionUI(modelId) {
        this.modelPanelController.updatePositionUI(modelId);
    }
    
    // 스케일 UI 업데이트
    updateScaleUI(modelId) {
        this.modelPanelController.updateScaleUI(modelId);
    }
    
    // 거리 정보 UI 업데이트
    updateDistanceUI(modelId) {
        this.modelPanelController.updateDistanceUI(modelId);
    }
    
    // 마우스 좌표 정규화 함수
    updateMouseCoordinates(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    
    // 업데이트 (매 프레임 호출)
    update() {
        // 이벤트 컨트롤러 업데이트 - 이것이 내부적으로 모든 서브 컨트롤러를 업데이트함
        this.eventController.update();
        
        // 툴팁 컨트롤러 업데이트
        this.tooltipController.update();
    }
}