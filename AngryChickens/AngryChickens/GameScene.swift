import SpriteKit
import GameplayKit

class GameScene: SKScene, SKPhysicsContactDelegate {

    // Game state
    var gameState: GameState = .ready
    var currentLevel: Int = 1
    var score: Int = 0
    var remainingCats: Int = 3

    // Nodes
    var catNode: SKShapeNode?
    var slingshotNode: SKShapeNode!
    var slingshotBandLeft: SKShapeNode!
    var slingshotBandRight: SKShapeNode!
    var groundNode: SKShapeNode!
    var scoreLabel: SKLabelNode!
    var catsLabel: SKLabelNode!
    var messageLabel: SKLabelNode!

    // Slingshot properties
    let slingshotPosition = CGPoint(x: 200, y: 250)
    let maxStretch: CGFloat = 100
    var isDragging = false
    var launchVelocity = CGVector(dx: 0, dy: 0)

    // Game objects
    var chickens: [SKShapeNode] = []
    var blocks: [SKShapeNode] = []

    enum GameState {
        case ready
        case aiming
        case flying
        case gameOver
        case levelComplete
    }

    override func didMove(to view: SKView) {
        setupPhysics()
        setupUI()
        setupGround()
        setupSlingshot()
        loadLevel(currentLevel)
    }

    func setupPhysics() {
        physicsWorld.gravity = CGVector(dx: 0, dy: -9.8)
        physicsWorld.contactDelegate = self

        // Create edge boundary
        let border = SKPhysicsBody(edgeLoopFrom: self.frame)
        border.categoryBitMask = PhysicsCategory.edge
        self.physicsBody = border
    }

    func setupUI() {
        backgroundColor = SKColor(red: 0.53, green: 0.81, blue: 0.92, alpha: 1.0) // Sky blue

        // Score label
        scoreLabel = SKLabelNode(fontNamed: "Arial-BoldMT")
        scoreLabel.fontSize = 30
        scoreLabel.fontColor = .white
        scoreLabel.position = CGPoint(x: size.width - 100, y: size.height - 50)
        scoreLabel.text = "Score: 0"
        addChild(scoreLabel)

        // Cats remaining label
        catsLabel = SKLabelNode(fontNamed: "Arial-BoldMT")
        catsLabel.fontSize = 30
        catsLabel.fontColor = .white
        catsLabel.position = CGPoint(x: 100, y: size.height - 50)
        catsLabel.text = "Cats: \(remainingCats)"
        addChild(catsLabel)

        // Message label
        messageLabel = SKLabelNode(fontNamed: "Arial-BoldMT")
        messageLabel.fontSize = 40
        messageLabel.fontColor = .yellow
        messageLabel.position = CGPoint(x: size.width / 2, y: size.height / 2)
        messageLabel.isHidden = true
        addChild(messageLabel)
    }

    func setupGround() {
        let groundHeight: CGFloat = 100
        groundNode = SKShapeNode(rect: CGRect(x: 0, y: 0, width: size.width, height: groundHeight))
        groundNode.fillColor = SKColor(red: 0.4, green: 0.8, blue: 0.4, alpha: 1.0) // Green
        groundNode.strokeColor = .clear
        groundNode.position = CGPoint(x: 0, y: 0)
        groundNode.physicsBody = SKPhysicsBody(rectangleOf: CGSize(width: size.width, height: groundHeight))
        groundNode.physicsBody?.isDynamic = false
        groundNode.physicsBody?.categoryBitMask = PhysicsCategory.ground
        groundNode.physicsBody?.contactTestBitMask = PhysicsCategory.cat | PhysicsCategory.chicken | PhysicsCategory.block
        addChild(groundNode)
    }

    func setupSlingshot() {
        // Slingshot base
        slingshotNode = SKShapeNode(rectOf: CGSize(width: 20, height: 100), cornerRadius: 5)
        slingshotNode.fillColor = .brown
        slingshotNode.strokeColor = .darkGray
        slingshotNode.lineWidth = 2
        slingshotNode.position = slingshotPosition
        slingshotNode.zPosition = 1
        addChild(slingshotNode)

        // Left band
        slingshotBandLeft = SKShapeNode()
        slingshotBandLeft.strokeColor = .darkGray
        slingshotBandLeft.lineWidth = 3
        slingshotBandLeft.zPosition = 0
        addChild(slingshotBandLeft)

        // Right band
        slingshotBandRight = SKShapeNode()
        slingshotBandRight.strokeColor = .darkGray
        slingshotBandRight.lineWidth = 3
        slingshotBandRight.zPosition = 0
        addChild(slingshotBandRight)
    }

    func loadLevel(_ level: Int) {
        // Clear previous level
        chickens.forEach { $0.removeFromParent() }
        blocks.forEach { $0.removeFromParent() }
        chickens.removeAll()
        blocks.removeAll()

        remainingCats = 3
        score = 0
        updateUI()

        // Create structures and chickens based on level
        switch level {
        case 1:
            loadLevel1()
        case 2:
            loadLevel2()
        case 3:
            loadLevel3()
        default:
            loadLevel1()
        }

        prepareNewCat()
    }

    func loadLevel1() {
        // Simple structure with one chicken
        createBlock(at: CGPoint(x: size.width - 300, y: 150), width: 100, height: 20)
        createBlock(at: CGPoint(x: size.width - 350, y: 200), width: 20, height: 100)
        createBlock(at: CGPoint(x: size.width - 250, y: 200), width: 20, height: 100)
        createBlock(at: CGPoint(x: size.width - 300, y: 280), width: 100, height: 20)

        createChicken(at: CGPoint(x: size.width - 300, y: 200))
    }

    func loadLevel2() {
        // Pyramid structure with two chickens
        // Bottom row
        createBlock(at: CGPoint(x: size.width - 400, y: 150), width: 80, height: 20)
        createBlock(at: CGPoint(x: size.width - 300, y: 150), width: 80, height: 20)
        createBlock(at: CGPoint(x: size.width - 200, y: 150), width: 80, height: 20)

        // Middle row
        createBlock(at: CGPoint(x: size.width - 350, y: 200), width: 80, height: 20)
        createBlock(at: CGPoint(x: size.width - 250, y: 200), width: 80, height: 20)

        // Top
        createBlock(at: CGPoint(x: size.width - 300, y: 250), width: 80, height: 20)

        createChicken(at: CGPoint(x: size.width - 350, y: 180))
        createChicken(at: CGPoint(x: size.width - 250, y: 180))
    }

    func loadLevel3() {
        // Complex structure with three chickens
        // Left tower
        createBlock(at: CGPoint(x: size.width - 450, y: 150), width: 20, height: 100)
        createBlock(at: CGPoint(x: size.width - 450, y: 250), width: 20, height: 100)
        createBlock(at: CGPoint(x: size.width - 450, y: 330), width: 60, height: 20)

        // Right tower
        createBlock(at: CGPoint(x: size.width - 250, y: 150), width: 20, height: 100)
        createBlock(at: CGPoint(x: size.width - 250, y: 250), width: 20, height: 100)
        createBlock(at: CGPoint(x: size.width - 250, y: 330), width: 60, height: 20)

        // Middle platform
        createBlock(at: CGPoint(x: size.width - 350, y: 250), width: 140, height: 20)

        createChicken(at: CGPoint(x: size.width - 450, y: 180))
        createChicken(at: CGPoint(x: size.width - 350, y: 280))
        createChicken(at: CGPoint(x: size.width - 250, y: 180))
    }

    func createChicken(at position: CGPoint) {
        let chicken = SKShapeNode(circleOfRadius: 25)
        chicken.fillColor = .yellow
        chicken.strokeColor = .orange
        chicken.lineWidth = 3
        chicken.position = position
        chicken.zPosition = 2

        // Add simple features
        let eye1 = SKShapeNode(circleOfRadius: 5)
        eye1.fillColor = .black
        eye1.position = CGPoint(x: -8, y: 8)
        chicken.addChild(eye1)

        let eye2 = SKShapeNode(circleOfRadius: 5)
        eye2.fillColor = .black
        eye2.position = CGPoint(x: 8, y: 8)
        chicken.addChild(eye2)

        let beak = SKShapeNode(circleOfRadius: 4)
        beak.fillColor = .red
        beak.position = CGPoint(x: 0, y: -5)
        chicken.addChild(beak)

        chicken.physicsBody = SKPhysicsBody(circleOfRadius: 25)
        chicken.physicsBody?.mass = 1.0
        chicken.physicsBody?.categoryBitMask = PhysicsCategory.chicken
        chicken.physicsBody?.contactTestBitMask = PhysicsCategory.cat | PhysicsCategory.block | PhysicsCategory.ground
        chicken.physicsBody?.collisionBitMask = PhysicsCategory.cat | PhysicsCategory.block | PhysicsCategory.ground | PhysicsCategory.edge

        chickens.append(chicken)
        addChild(chicken)
    }

    func createBlock(at position: CGPoint, width: CGFloat, height: CGFloat) {
        let block = SKShapeNode(rectOf: CGSize(width: width, height: height), cornerRadius: 3)
        block.fillColor = .brown
        block.strokeColor = .darkGray
        block.lineWidth = 2
        block.position = position
        block.zPosition = 2

        block.physicsBody = SKPhysicsBody(rectangleOf: CGSize(width: width, height: height))
        block.physicsBody?.mass = 0.5
        block.physicsBody?.categoryBitMask = PhysicsCategory.block
        block.physicsBody?.contactTestBitMask = PhysicsCategory.cat | PhysicsCategory.chicken | PhysicsCategory.ground
        block.physicsBody?.collisionBitMask = PhysicsCategory.cat | PhysicsCategory.chicken | PhysicsCategory.block | PhysicsCategory.ground | PhysicsCategory.edge

        blocks.append(block)
        addChild(block)
    }

    func prepareNewCat() {
        if remainingCats <= 0 {
            checkGameOver()
            return
        }

        catNode = SKShapeNode(circleOfRadius: 20)
        catNode!.fillColor = .gray
        catNode!.strokeColor = .darkGray
        catNode!.lineWidth = 3
        catNode!.position = slingshotPosition
        catNode!.zPosition = 3

        // Add cat features
        let ear1 = SKShapeNode(circleOfRadius: 8)
        ear1.fillColor = .gray
        ear1.position = CGPoint(x: -12, y: 15)
        catNode!.addChild(ear1)

        let ear2 = SKShapeNode(circleOfRadius: 8)
        ear2.fillColor = .gray
        ear2.position = CGPoint(x: 12, y: 15)
        catNode!.addChild(ear2)

        let eye1 = SKShapeNode(circleOfRadius: 4)
        eye1.fillColor = .green
        eye1.position = CGPoint(x: -7, y: 5)
        catNode!.addChild(eye1)

        let eye2 = SKShapeNode(circleOfRadius: 4)
        eye2.fillColor = .green
        eye2.position = CGPoint(x: 7, y: 5)
        catNode!.addChild(eye2)

        addChild(catNode!)
        gameState = .ready
        updateSlingshotBands()
    }

    func launchCat() {
        guard let cat = catNode else { return }

        cat.physicsBody = SKPhysicsBody(circleOfRadius: 20)
        cat.physicsBody?.mass = 2.0
        cat.physicsBody?.categoryBitMask = PhysicsCategory.cat
        cat.physicsBody?.contactTestBitMask = PhysicsCategory.chicken | PhysicsCategory.block | PhysicsCategory.ground
        cat.physicsBody?.collisionBitMask = PhysicsCategory.chicken | PhysicsCategory.block | PhysicsCategory.ground | PhysicsCategory.edge
        cat.physicsBody?.applyImpulse(launchVelocity)
        cat.physicsBody?.angularVelocity = 3

        catNode = nil
        remainingCats -= 1
        updateUI()
        gameState = .flying

        // Hide slingshot bands
        slingshotBandLeft.path = nil
        slingshotBandRight.path = nil

        // Schedule check for next cat after a delay
        run(SKAction.sequence([
            SKAction.wait(forDuration: 3.0),
            SKAction.run { [weak self] in
                self?.checkIfCatStopped()
            }
        ]))
    }

    func checkIfCatStopped() {
        if gameState == .flying {
            prepareNewCat()
        }
    }

    func updateSlingshotBands() {
        guard let cat = catNode else {
            slingshotBandLeft.path = nil
            slingshotBandRight.path = nil
            return
        }

        let leftPath = CGMutablePath()
        leftPath.move(to: CGPoint(x: slingshotPosition.x - 10, y: slingshotPosition.y + 40))
        leftPath.addLine(to: cat.position)
        slingshotBandLeft.path = leftPath

        let rightPath = CGMutablePath()
        rightPath.move(to: CGPoint(x: slingshotPosition.x + 10, y: slingshotPosition.y + 40))
        rightPath.addLine(to: cat.position)
        slingshotBandRight.path = rightPath
    }

    func updateUI() {
        scoreLabel.text = "Score: \(score)"
        catsLabel.text = "Cats: \(remainingCats)"
    }

    func checkGameOver() {
        if chickens.filter({ !$0.isHidden && $0.parent != nil }).isEmpty {
            showMessage("Level Complete!", completion: {
                self.currentLevel += 1
                if self.currentLevel > 3 {
                    self.currentLevel = 1
                    self.showMessage("You Win! Restarting...", completion: {
                        self.loadLevel(self.currentLevel)
                    })
                } else {
                    self.loadLevel(self.currentLevel)
                }
            })
        } else if remainingCats == 0 && gameState != .flying {
            showMessage("Game Over! Tap to Restart", completion: {
                self.currentLevel = 1
                self.loadLevel(self.currentLevel)
            })
        }
    }

    func showMessage(_ message: String, completion: @escaping () -> Void) {
        messageLabel.text = message
        messageLabel.isHidden = false
        messageLabel.setScale(0)

        let scaleUp = SKAction.scale(to: 1.0, duration: 0.3)
        let wait = SKAction.wait(forDuration: 2.0)
        let scaleDown = SKAction.scale(to: 0, duration: 0.3)
        let hide = SKAction.run { [weak self] in
            self?.messageLabel.isHidden = true
            completion()
        }

        messageLabel.run(SKAction.sequence([scaleUp, wait, scaleDown, hide]))
    }

    // MARK: - Touch Handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let location = touch.location(in: self)

        if gameState == .ready, let cat = catNode, cat.contains(location) {
            isDragging = true
            gameState = .aiming
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard isDragging, let touch = touches.first, let cat = catNode else { return }

        var location = touch.location(in: self)

        // Constrain to slingshot area
        let dx = location.x - slingshotPosition.x
        let dy = location.y - slingshotPosition.y
        let distance = sqrt(dx * dx + dy * dy)

        if distance > maxStretch {
            let angle = atan2(dy, dx)
            location.x = slingshotPosition.x + cos(angle) * maxStretch
            location.y = slingshotPosition.y + sin(angle) * maxStretch
        }

        // Only allow pulling back (to the left)
        if location.x > slingshotPosition.x {
            location.x = slingshotPosition.x
        }

        cat.position = location
        updateSlingshotBands()

        // Calculate launch velocity
        let pullDistance = CGPoint(x: slingshotPosition.x - location.x,
                                 y: slingshotPosition.y - location.y)
        launchVelocity = CGVector(dx: pullDistance.x * 2, dy: pullDistance.y * 2)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        if isDragging && gameState == .aiming {
            isDragging = false
            launchCat()
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        if isDragging {
            isDragging = false
            catNode?.position = slingshotPosition
            updateSlingshotBands()
            gameState = .ready
        }
    }

    // MARK: - Physics Contact Delegate

    func didBegin(_ contact: SKPhysicsContact) {
        let collision = contact.bodyA.categoryBitMask | contact.bodyB.categoryBitMask

        if collision == PhysicsCategory.cat | PhysicsCategory.chicken {
            handleCatChickenCollision(contact)
        }

        // Check for high-velocity impacts
        if contact.collisionImpulse > 50 {
            if contact.bodyA.categoryBitMask == PhysicsCategory.chicken || contact.bodyB.categoryBitMask == PhysicsCategory.chicken {
                handleChickenDamage(contact)
            }
        }
    }

    func handleCatChickenCollision(_ contact: SKPhysicsContact) {
        let chickenNode = contact.bodyA.categoryBitMask == PhysicsCategory.chicken ? contact.bodyA.node : contact.bodyB.node

        if let chicken = chickenNode as? SKShapeNode, chickens.contains(chicken) {
            // Hit effect
            let scaleUp = SKAction.scale(to: 1.3, duration: 0.1)
            let scaleDown = SKAction.scale(to: 0, duration: 0.2)
            let remove = SKAction.removeFromParent()

            chicken.run(SKAction.sequence([scaleUp, scaleDown, remove]))

            score += 100
            updateUI()

            // Check if level complete
            run(SKAction.sequence([
                SKAction.wait(forDuration: 1.0),
                SKAction.run { [weak self] in
                    self?.checkGameOver()
                }
            ]))
        }
    }

    func handleChickenDamage(_ contact: SKPhysicsContact) {
        let chickenNode = contact.bodyA.categoryBitMask == PhysicsCategory.chicken ? contact.bodyA.node : contact.bodyB.node

        if let chicken = chickenNode as? SKShapeNode, chickens.contains(chicken), contact.collisionImpulse > 100 {
            // Chicken damaged by falling blocks
            let scaleUp = SKAction.scale(to: 1.2, duration: 0.1)
            let scaleDown = SKAction.scale(to: 0, duration: 0.2)
            let remove = SKAction.removeFromParent()

            chicken.run(SKAction.sequence([scaleUp, scaleDown, remove]))

            score += 50
            updateUI()

            run(SKAction.sequence([
                SKAction.wait(forDuration: 1.0),
                SKAction.run { [weak self] in
                    self?.checkGameOver()
                }
            ]))
        }
    }

    override func update(_ currentTime: TimeInterval) {
        // Clean up nodes that fell off screen
        children.forEach { node in
            if node.position.y < -100 {
                node.removeFromParent()
            }
        }
    }
}
