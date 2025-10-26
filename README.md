# Angry Chickens

An Angry Birds-style physics-based game for iOS featuring cats as projectiles and chickens as targets!

## Overview

Angry Chickens is a fun, physics-based puzzle game where you launch cats using a slingshot to knock down structures and defeat chickens. Built with Swift and SpriteKit, this game demonstrates realistic physics, collision detection, and engaging gameplay mechanics.

## Features

- **Physics-Based Gameplay**: Realistic gravity and collision physics using SpriteKit
- **Slingshot Mechanics**: Pull back and release to launch cats at structures
- **Multiple Levels**: 3 unique levels with increasing difficulty
- **Scoring System**: Earn points for hitting chickens and destroying structures
- **Visual Feedback**: Watch structures collapse and chickens react to impacts
- **Landscape Mode**: Optimized for landscape orientation gameplay

## Gameplay

### Objective
Launch cats from the slingshot to defeat all the chickens in each level. You have a limited number of cats per level, so aim carefully!

### Controls
1. **Pull Back**: Touch and drag the cat on the slingshot backwards
2. **Aim**: Move your finger to adjust the angle and power
3. **Release**: Let go to launch the cat

### Scoring
- Hit a chicken directly: **100 points**
- Destroy a chicken with falling debris: **50 points**
- Complete the level with fewer cats for bonus satisfaction!

### Game Mechanics
- **Cats**: Your projectiles - heavy and destructive
- **Chickens**: The targets you need to defeat
- **Brown Blocks**: Wooden structures that can be destroyed
- **Green Ground**: The stable surface everything rests on
- **Slingshot**: Your launching mechanism with elastic bands

## Technical Details

### Built With
- **Language**: Swift 5.0
- **Framework**: SpriteKit (Apple's 2D game engine)
- **Physics**: SpriteKit Physics Engine
- **Platform**: iOS 15.0+
- **Orientation**: Landscape

### Project Structure
```
AngryChickens/
├── AngryChickens.xcodeproj/
│   └── project.pbxproj
└── AngryChickens/
    ├── AppDelegate.swift          # App lifecycle management
    ├── SceneDelegate.swift        # Scene lifecycle management
    ├── GameViewController.swift   # Main view controller
    ├── GameScene.swift           # Core game logic and physics
    ├── PhysicsCategory.swift     # Physics collision categories
    ├── Info.plist               # App configuration
    └── Assets.xcassets/         # Game assets
```

### Key Classes

#### GameScene.swift
The main game scene containing:
- Physics world setup and gravity
- Slingshot mechanics and touch handling
- Game state management
- Level loading and progression
- Collision detection and scoring
- UI elements (score, remaining cats)

#### PhysicsCategory.swift
Defines collision categories:
- Cat (projectile)
- Chicken (target)
- Block (destructible objects)
- Ground (stable surface)
- Edge (screen boundaries)

## Installation & Setup

### Requirements
- macOS with Xcode 14.0 or later
- iOS 15.0+ device or simulator
- Apple Developer account (for device deployment)

### Building the Project

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd angry-chickens
   ```

2. **Open in Xcode**
   ```bash
   cd AngryChickens
   open AngryChickens.xcodeproj
   ```

3. **Select a target**
   - Choose an iOS Simulator or connected device from the scheme selector
   - Select iPhone 14 or newer for best experience

4. **Build and Run**
   - Press `Cmd + R` or click the Play button
   - The game will build and launch automatically

### Running on Device

1. Connect your iOS device via USB
2. In Xcode, select your device from the scheme selector
3. Go to **Signing & Capabilities** tab
4. Select your Apple Developer team
5. Build and run (`Cmd + R`)

## Game Levels

### Level 1: Tutorial
Simple structure with one chicken. Perfect for learning the mechanics.

### Level 2: Pyramid Challenge
A pyramid structure with two chickens. Requires strategic aiming.

### Level 3: Twin Towers
Complex structure with three chickens spread across two towers. The ultimate challenge!

## Development Notes

### Physics Configuration
- Gravity: -9.8 (realistic Earth gravity)
- Cat mass: 2.0 (heavier for impact)
- Chicken mass: 1.0 (standard)
- Block mass: 0.5 (lighter, easier to destroy)

### Customization Ideas
Want to modify the game? Here are some ideas:

1. **Add More Levels**: Edit `loadLevel()` in GameScene.swift
2. **Change Physics**: Adjust mass and gravity values
3. **New Projectiles**: Create different cat types with unique properties
4. **Power-ups**: Add special abilities or effects
5. **Sound Effects**: Integrate audio using AVFoundation
6. **Particle Effects**: Add explosions and debris using SKEmitterNode

### Debug Features
The game includes helpful debug visualizations:
- **FPS Counter**: Monitor frame rate performance
- **Node Count**: Track active nodes in the scene
- **Physics Bodies**: Visual outlines of all physics objects

These can be disabled in `GameViewController.swift:15-17`

## Troubleshooting

### Game doesn't launch
- Ensure you're targeting iOS 15.0 or later
- Check that the simulator/device is properly selected
- Clean build folder (`Cmd + Shift + K`) and rebuild

### Physics seem off
- Verify gravity is set to -9.8 in `setupPhysics()`
- Check that all physics bodies have appropriate masses
- Ensure collision and contact masks are properly configured

### Slingshot not working
- Make sure you're touching directly on the cat node
- Verify touch handling is not being blocked
- Check that `isDragging` flag is being set correctly

## Future Enhancements

Potential features for future versions:
- [ ] More levels with varied difficulty
- [ ] Different cat types with special abilities
- [ ] Sound effects and background music
- [ ] Level editor for custom stages
- [ ] Achievements and leaderboards
- [ ] Improved graphics with custom sprites
- [ ] Tutorial/Help screen
- [ ] Settings menu
- [ ] Save/load game progress

## Contributing

Feel free to fork this project and add your own features! Some contribution ideas:
- Add new level designs
- Create custom graphics/sprites
- Implement sound effects
- Add particle effects
- Optimize performance
- Add new game mechanics

## License

This project is provided as-is for educational purposes.

## Acknowledgments

Inspired by the classic Angry Birds game, reimagined with cats and chickens for a fun twist on the physics puzzle genre.

---

**Have fun launching cats at chickens!**
