import * as THREE from 'three';

export class UIMeasureController {
    constructor(eventController) {
        // 부모 이벤트 컨트롤러 참조
        this.eventController = eventController;
        
        // 단축 참조 설정
        this.uiController = eventController.uiController;
        this.camera = eventController.camera;
        this.raycaster = eventController.raycaster;
        this.mouse = eventController.mouse;
        this.scene = eventController.scene;
        
        // 측정 관련 변수
        this.isMeasuring = false;
        this.firstPoint = null;
        this.secondPoint = null;
        this.currentMeasureLine = null;
        this.measureCount = 0; // 측정 횟수 카운팅
        
        // 측정 객체 저장 배열
        this.measureLines = [];
        this.measurePoints = [];
        this.measureLabels = [];
        
        // DOM 요소
        this.measureToggle = document.getElementById('distanceMeasureToggle');
        this.measureInfo = document.getElementById('measureInfo');
        this.measureInfoText = document.getElementById('measureInfoText');
        this.cancelMeasureButton = document.getElementById('cancelMeasureButton');
        this.clearAllMeasureButton = document.getElementById('clearAllMeasureButton'); // 추가된 부분
        this.measureResultContainer = document.getElementById('measureResultContainer');
        this.measureResult = document.getElementById('measureResult');
        
        // 객체 생성
        this.measureGroup = new THREE.Group();
        this.measureGroup.name = 'measureGroup';
        this.scene.add(this.measureGroup);
        
        // 색상 설정
        this.pointColor = 0xffff00; // 노란색
        this.lineColor = 0x00ffff;  // 청록색
        this.labelColor = 'white';  // 흰색 텍스트
        
        // 이벤트 핸들러 바인딩
        this.handleMeasureToggle = this.handleMeasureToggle.bind(this);
        this.handleCanvasClick = this.handleCanvasClick.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.cancelMeasurement = this.cancelMeasurement.bind(this);
        this.clearAllMeasurements = this.clearAllMeasurements.bind(this); // 추가된 부분
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 거리재기 체크박스 이벤트
        if (this.measureToggle) {
            this.measureToggle.addEventListener('change', this.handleMeasureToggle);
        }
        
        // 취소 버튼 이벤트
        if (this.cancelMeasureButton) {
            this.cancelMeasureButton.addEventListener('click', this.cancelMeasurement);
        }
        
        // 모두 삭제 버튼 이벤트 (추가된 부분)
        if (this.clearAllMeasureButton) {
            this.clearAllMeasureButton.addEventListener('click', this.clearAllMeasurements);
        }
        
        // 오른쪽 클릭 이벤트
        this.eventController.canvas.addEventListener('contextmenu', this.handleContextMenu);
    }
    
    // 오른쪽 클릭 처리 (측정 모드 취소)
    handleContextMenu(event) {
        if (this.isMeasuring) {
            event.preventDefault(); // 기본 컨텍스트 메뉴 방지
            
            // 현재 진행 중인 측정만 취소 (이전 측정은 유지)
            this.resetCurrentMeasurement();
            this.measureInfoText.textContent = '첫번째 지점을 선택하세요';
            
            return true;
        }
        return false;
    }
    
    // 거리재기 토글 처리
    handleMeasureToggle(event) {
        this.isMeasuring = event.target.checked;
        
        if (this.isMeasuring) {
            // 측정 모드 시작
            this.startMeasurement();
        } else {
            // 측정 모드 종료 (이전 측정값은 유지)
            this.resetCurrentMeasurement();
            
            // 안내 메시지 숨기기
            this.measureInfo.style.display = 'none';
            
            // 다른 컨트롤러에 측정 모드 종료 알림
            this.eventController.setMeasuringMode(false);
        }
    }
    
    // 측정 모드 시작
    startMeasurement() {
        // 현재 진행 중인 측정만 초기화 (이전 측정값은 유지)
        this.resetCurrentMeasurement();
        
        // 안내 메시지 표시
        this.measureInfo.style.display = 'flex';
        this.measureInfoText.textContent = '첫번째 지점을 선택하세요';
        
        // 다른 컨트롤러에 측정 모드 알림
        this.eventController.setMeasuringMode(true);
        
        console.log('거리재기 모드 시작');
    }
    
    // 캔버스 클릭 처리 (거리 측정용)
    handleCanvasClick(event) {
        if (!this.isMeasuring) return false;
        
        // 마우스 좌표 정규화
        this.uiController.updateMouseCoordinates(event);
        
        // 레이캐스터 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 그리드 시스템 참조 가져오기
        const gridSystem = this.eventController.uiController.gridSystem;
        if (!gridSystem) return false;
        
        // 그리드 평면과의 교차점 계산 (항상 Y=0 평면)
        const planeNormal = new THREE.Vector3(0, 1, 0); // Y축 방향 (바닥 면)
        const plane = new THREE.Plane(planeNormal, 0); // Y=0 평면
        const intersectPoint = new THREE.Vector3();
        const intersected = this.raycaster.ray.intersectPlane(plane, intersectPoint);
        
        if (intersected) {
            // 교차점이 그리드 경계 내에 있는지 확인
            if (!gridSystem.isWithinBoundary(intersectPoint)) {
                // 그리드 외부 클릭은 무시
                this.showMessage("그리드 영역 내에서만 측정할 수 있습니다.");
                return true; // 이벤트 처리됨으로 간주
            }
            
            if (!this.firstPoint) {
                // 첫번째 점 설정
                this.firstPoint = intersectPoint.clone();
                // Y좌표는 0으로 고정 (그리드 평면 상에 위치)
                this.firstPoint.y = 0;
                this.createMeasurePoint(this.firstPoint, `${this.measureCount + 1}-1`);
                
                // 안내 메시지 업데이트
                this.measureInfoText.textContent = '두번째 지점을 선택하세요';
                
                return true; // 이벤트 처리됨
            } else if (!this.secondPoint) {
                // 두번째 점 설정
                this.secondPoint = intersectPoint.clone();
                // Y좌표는 0으로 고정 (그리드 평면 상에 위치)
                this.secondPoint.y = 0;
                this.createMeasurePoint(this.secondPoint, `${this.measureCount + 1}-2`);
                
                // 두 점 사이 선 그리기
                this.currentMeasureLine = this.createMeasureLine(this.firstPoint, this.secondPoint);
                
                // 측정 횟수 증가
                this.measureCount++;
                
                // 측정 결과 계산 및 표시
                this.calculateAndDisplayDistance(this.firstPoint, this.secondPoint);
                
                // 안내 메시지 업데이트
                this.measureInfoText.textContent = '다음 측정을 위해 첫번째 지점을 선택하세요';
                
                // 다음 측정을 위해 초기화 (선과 점은 유지)
                this.resetCurrentMeasurement();
                
                return true; // 이벤트 처리됨
            }
        }
        
        return false; // 이벤트 처리되지 않음
}
    
    // 측정 포인트 생성
    createMeasurePoint(position, label) {
        // 포인트 구체 생성
        const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: this.pointColor });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(position);
        
        // 포인트 라벨 생성
        const labelSprite = this.createTextLabel(label, position.clone().add(new THREE.Vector3(0, 0.3, 0)));
        
        // 측정 그룹에 추가
        this.measureGroup.add(sphere);
        this.measureGroup.add(labelSprite);
        
        // 참조 저장
        this.measurePoints.push(sphere);
        this.measureLabels.push(labelSprite);
    }
    
    // 측정 선 생성
    createMeasureLine(start, end) {
        // 두 점의 y좌표 강제로 0으로 설정 (그리드 평면 위에 위치)
        const startPoint = start.clone();
        const endPoint = end.clone();
        startPoint.y = 0.05; // 바닥 위에 살짝 띄움
        endPoint.y = 0.05;   // 바닥 위에 살짝 띄움
        
        // 선 지오메트리 생성
        const lineGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            startPoint.x, startPoint.y, startPoint.z,
            endPoint.x, endPoint.y, endPoint.z
        ]);
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        // 선 머터리얼 생성 (점선)
        const lineMaterial = new THREE.LineDashedMaterial({
            color: this.lineColor,
            dashSize: 0.2,
            gapSize: 0.1,
            linewidth: 2
        });
        
        // 선 생성
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.computeLineDistances(); // 점선을 위해 필요
        
        // 중간 지점에 거리 레이블 추가
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        midPoint.y = 0.25; // 바닥 위에 살짝 띄움
        
        // 거리 계산 (바닥 평면 상에서의 거리만 고려)
        const distance = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) +
            Math.pow(endPoint.z - startPoint.z, 2)
        );
        
        const distanceLabel = this.createTextLabel(`${distance.toFixed(2)}m`, midPoint);
        
        // 측정 선 객체 생성
        const measureLine = {
            line: line,
            label: distanceLabel,
            startPoint: startPoint.clone(),
            endPoint: endPoint.clone()
        };
        
        // 측정 그룹에 추가
        this.measureGroup.add(line);
        this.measureGroup.add(distanceLabel);
        
        // 레이블 참조 저장
        this.measureLabels.push(distanceLabel);
        
        // 측정 선 배열에 추가
        this.measureLines.push(measureLine);
        
        return measureLine;
    }
    
    // 텍스트 레이블 생성
    createTextLabel(text, position) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.fillStyle = this.labelColor;
        context.font = 'Bold 40px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(1, 0.5, 1);
        
        return sprite;
    }
    
    // 거리 계산 및 결과 표시
    calculateAndDisplayDistance(point1, point2) {
        if (!point1 || !point2) return;
        
        // 수평 거리 계산 (Y 무시) - 이제는 이 값이 주 거리 값이 됨
        const horizontalDistance = Math.sqrt(
            Math.pow(point2.x - point1.x, 2) +
            Math.pow(point2.z - point1.z, 2)
        );
        
        // 측정 ID (번호)
        const measureId = this.measureCount + 1;
        
        // 기존 결과에 새 결과 추가
        let resultHTML = this.measureResult.innerHTML;
        
        // 첫 측정이면 내용 초기화
        if (this.measureCount === 0) {
            resultHTML = '';
        }
        
        // 결과 추가 (이제 Y 좌표는 항상 0이므로 수직 거리 항목 제거)
        resultHTML += `
            <div class="measure-item">
                <div class="measure-header">측정 #${measureId}</div>
                <div>거리: <strong>${horizontalDistance.toFixed(2)}</strong>m</div>
                <div class="measure-points">
                    <div>시작점: (${point1.x.toFixed(2)}, ${point1.z.toFixed(2)})</div>
                    <div>끝점: (${point2.x.toFixed(2)}, ${point2.z.toFixed(2)})</div>
                </div>
            </div>
        `;
        
        // 결과 표시
        this.measureResultContainer.style.display = 'block';
        this.measureResult.innerHTML = resultHTML;
    }
    
    // 측정 취소
    cancelMeasurement() {
        if (this.isMeasuring) {
            // 체크박스 해제
            if (this.measureToggle) {
                this.measureToggle.checked = false;
            }
            
            // 측정 모드 종료
            this.isMeasuring = false;
            this.resetCurrentMeasurement();
            
            // 안내 메시지 숨기기
            this.measureInfo.style.display = 'none';
            
            // 다른 컨트롤러에 측정 모드 종료 알림
            this.eventController.setMeasuringMode(false);
        }
    }
    
    // 모든 측정 데이터 삭제
    clearAllMeasurements() {
        // 현재 진행 중인 측정 초기화
        this.resetCurrentMeasurement();
        
        // 모든 측정 선 제거
        while (this.measureLines.length > 0) {
            const measureLine = this.measureLines.pop();
            this.measureGroup.remove(measureLine.line);
            this.measureGroup.remove(measureLine.label);
            
            if (measureLine.line.geometry) measureLine.line.geometry.dispose();
            if (measureLine.line.material) measureLine.line.material.dispose();
            
            if (measureLine.label.material) {
                if (measureLine.label.material.map) measureLine.label.material.map.dispose();
                measureLine.label.material.dispose();
            }
        }
        
        // 모든 측정 포인트와 라벨 제거
        while (this.measurePoints.length > 0) {
            const point = this.measurePoints.pop();
            this.measureGroup.remove(point);
            if (point.geometry) point.geometry.dispose();
            if (point.material) point.material.dispose();
        }
        
        // 모든 레이블 제거 (아직 제거되지 않은 것들)
        while (this.measureLabels.length > 0) {
            const label = this.measureLabels.pop();
            this.measureGroup.remove(label);
            if (label.material) {
                if (label.material.map) label.material.map.dispose();
                label.material.dispose();
            }
        }
        
        // 측정 횟수 초기화
        this.measureCount = 0;
        
        // UI 요소 초기화
        this.measureResultContainer.style.display = 'none';
        this.measureResult.innerHTML = '';
        
        // 측정 모드가 활성화된 상태라면 안내 메시지 갱신
        if (this.isMeasuring) {
            this.measureInfoText.textContent = '첫번째 지점을 선택하세요';
        }
    }

    // 메시지 표시 함수
    showMessage(message, duration = 2000) {
        // 이미 존재하는 메시지 요소 확인
        let messageElement = document.getElementById('measure-message');
        
        // 없으면 새로 생성
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'measure-message';
            messageElement.className = 'measure-message';
            document.body.appendChild(messageElement);
        }
        
        // 메시지 설정
        messageElement.textContent = message;
        messageElement.style.display = 'block';
        
        // 기존 타이머 제거
        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
        }
        
        // 일정 시간 후 메시지 숨기기
        this.messageTimer = setTimeout(() => {
            messageElement.style.opacity = '0';
            
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.style.opacity = '1';
            }, 300);
        }, duration);
    }
    
    // 현재 진행 중인 측정만 초기화
    resetCurrentMeasurement() {
        // 변수 초기화
        this.firstPoint = null;
        this.secondPoint = null;
        this.currentMeasureLine = null;
    }
    
    // 업데이트 (매 프레임 호출)
    update() {
        // 필요한 경우 여기에 프레임별 업데이트 로직 추가
    }
}