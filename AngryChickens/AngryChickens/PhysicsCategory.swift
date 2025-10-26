import Foundation

struct PhysicsCategory {
    static let none: UInt32 = 0
    static let cat: UInt32 = 0b1        // 1
    static let chicken: UInt32 = 0b10   // 2
    static let block: UInt32 = 0b100    // 4
    static let ground: UInt32 = 0b1000  // 8
    static let edge: UInt32 = 0b10000   // 16
}
