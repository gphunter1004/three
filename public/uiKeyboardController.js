import * as THREE from 'three';

export class UIKeyboardController {
    constructor(eventController) {
        // 부모 이벤트 컨트롤러 참조
        this.eventController = eventController;
        
        // 단축 참조 설정
        this.uiController = eventController.uiController;
        this.modelManager = eventController.modelManager;
        this.distanceController = null; // 나중에 설정됨
        
        // 키보드 이동 관련 변수
        this.keyStep = 0.1; // 기본 이동 거리
        this.fineKeyStep = 0.01; // Shift 키와 함께 사용할 때 미세 조정용
        this.keyboardMoveEnabled = true; // 키보드 이동 활성화 상태
        
        // 키보드 이벤트 핸들러 바인딩
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 키보드 이벤트
        document.addEventListener('keydown', this.handleKeyDown);
        
        // 거리 컨트롤러 참조 설정 (순환 참조 방지를 위해 이벤트 리스너 설정 후 설정)
        this.distanceController = this.eventController.distanceController;
    }
    
    // 키보드 이벤트 처리
    handleKeyDown(event) {
        if (!this.keyboardMoveEnabled) return;
        
        const selectedModelId = this.modelManager.getSelectedModelId();
        if (selectedModelId === null) return;
        
        const selectedObject = this.modelManager.getSelectedObject();
        if (!selectedObject) return;
        
        const previousPosition = selectedObject.position.clone();
        let newPosition = previousPosition.clone();
        
        // 이동 거리 결정 (Shift 키 누르고 있으면 미세 조정)
        const step = event.shiftKey ? this.fineKeyStep : this.keyStep;
        
        switch (event.key) {
            case 'ArrowLeft':
                newPosition.x -= step;
                event.preventDefault();
                break;
            case 'ArrowRight':
                newPosition.x += step;
                event.preventDefault();
                break;
            case 'ArrowUp':
                newPosition.z -= step;
                event.preventDefault();
                break;
            case 'ArrowDown':
                newPosition.z += step;
                event.preventDefault();
                break;
            case 'q': // Q 키를 누르면 반시계 방향으로 90도 회전
                this.modelManager.rotateModelBy90Degrees(selectedModelId, false);
                event.preventDefault();
                break;
            case 'e': // E 키를 누르면 시계 방향으로 90도 회전
                this.modelManager.rotateModelBy90Degrees(selectedModelId, true);
                event.preventDefault();
                break;
            case '+': 
            case '=': // 키패드에 따라 다를 수 있어 = 키도 추가
                // Shift 키와 함께 누르면 1%, 아니면 10% 확대
                const growFactor = event.shiftKey ? 1.01 : 1.1;
                this.modelManager.scaleModel(selectedModelId, growFactor);
                this.uiController.updateScaleUI(selectedModelId);
                event.preventDefault();
                break;
            case '-': 
                // Shift 키와 함께 누르면 1%, 아니면 10% 축소
                const shrinkFactor = event.shiftKey ? 0.99 : 0.9;
                this.modelManager.scaleModel(selectedModelId, shrinkFactor);
                this.uiController.updateScaleUI(selectedModelId);
                event.preventDefault();
                break;
            default:
                return; // 다른 키는 처리하지 않음
        }
        
        // Y값은 항상 0으로 고정
        newPosition.y = 0;
        
        // 모델 이동 시도
        const moved = this.modelManager.moveSelectedModel(newPosition, previousPosition);
        
        // 이동 성공 시 위치 UI 업데이트
        if (moved) {
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
    
    // 업데이트 (매 프레임 호출)
    update() {
        // 여기에 필요하다면 프레임별 업데이트 로직 추가
    }
}