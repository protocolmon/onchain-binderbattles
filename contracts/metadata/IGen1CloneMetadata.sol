// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface IGen1CloneMetadata {
    enum Background {
        None,
        Grassland,
        MaticBay,
        MountainRange,
        HauntedHills,
        SantasWonderland,
        WinterWonderland,
        CrystalCavern,
        GreenGardens,
        PhantomSummit,
        Ghostland,
        SpiritBay,
        GenesisFactory,
        AssemblyLab,
        RDHeadquarters,
        VirtualTestingRealm,
        NocturnalGenesisFactory,
        Exopolis
    }

    enum Color {
        None,
        Green,
        Blue,
        Red,
        Yellow,
        Purple,
        Black,
        RoseGold,
        WhiteGold,
        PureGold,
        LightRainbow,
        DarkRainbow
    }

    enum Glitter {
        None,
        Glitter
    }

    enum GlitterRainbow {
        None,
        Glitter,
        Rainbow
    }

    enum GlitterCrystal {
        None,
        Glitter,
        Gold,
        Crystal
    }

    enum GlitterExomon {
        None,
        Glitter,
        SapphireField,
        MatrixShield
    }

    enum Horn {
        None,
        GoldenHorn,
        SpiralHorn,
        SilverEdge,
        CandyCane,
        SilverClaw,
        DragonClaw,
        ShadowBranch,
        IvoryFang,
        WickedSpear,
        DiamondSpear
    }

    enum Type {
        None,
        Unidonkey,
        Unisheep,
        Unichick,
        Unifairy,
        Unicursed,
        Uniturtle,
        Unikles,
        Uniair,
        Unibranch,
        Uniaqua,
        Unidragon,
        Uniphoenix,
        Unishiba,
        Unigiraffe,
        Unioctopus,
        Unibull,
        Unitiger,
        Unipanda,
        Unizilla,
        MysteriousEgg
    }

    enum TypeSpecial {
        None,
        BitcoinUnidragon,
        FirstUnidragon,
        EthereumUnikles,
        MoneroUnicursed,
        PolkadotUnidonkey,
        TixlUnibranch,
        ElrondUnidragon,
        PolygonUnifairy,
        ChainlinkUniturtle,
        DancingUnipangolin,
        SushiUnisheep,
        PancakeUniair,
        BinanceUnidragon,
        YieldUnichick,
        PolkadexUnikles,
        DogeUnishiba,
        RealmUniphoenix,
        ReefUniaqua,
        BittyUniair,
        EttieUniair,
        DoggieUniair,
        BrokoliUniturtle,
        GlitchedUnidonkey,
        TofuUnizilla,
        MultivacUnipanda,
        CardanoUnibranch,
        DefiUnioctopus,
        MasterUnicursed,
        PoliteUnidonkey,
        PopcornUniair,
        CodyfightUniair,
        NeoUnigiraffe,
        FuryUnitiger,
        SkillfulUnikles,
        ChristmasUnibranch,
        SatoshiBabydragon,
        LitoshiBabydragon,
        PolkaBabydragon,
        WindvaneUnibull,
        BinanceBabydragon,
        ColchianUnidragon,
        GoldenExodonkey,
        GoldenExofairy,
        GoldenExochick,
        GoldenExocursed,
        GoldenExoaqua,
        GoldenExokles,
        GoldenExosheep,
        GoldenExoturtle,
        GoldenExobranch,
        GoldenExoair,
        GoldenExodragon
    }

    enum SubCollection {
        None,
        OriginGenesis,
        Origin1stEdition,
        OriginSpecialEdition,
        ExpansionBinanceGardens,
        ExpansionGreenGardens,
        ExpansionRainbowFusion,
        ExpansionSpecialsUnlimited,
        ExpansionGhostRealm,
        ExpansionCrystalCavern,
        SagaHauntedHills,
        SagaWinterWonderland,
        SagaSantasWonderland,
        SagaShadesOfGold,
        ExpansionExopolis
    }

    enum Variant {
        None,
        AirdropYes,
        ClaimableYes,
        FireYellow,
        FireRed,
        FireGreen,
        FireBlue,
        FirePurple,
        FireBinance,
        DancefloorHipHop,
        DancefloorClassic,
        DancefloorRock,
        DancefloorSalsa,
        DancefloorTechno,
        StakingAmount10Plus,
        StakingAmount100Plus,
        StakingAmount1000Plus,
        StakingAmount10000Plus,
        StakingAmount100000Plus,
        ChristmasAntlers,
        ChristmasDiamondAntlers,
        ChristmasPresent,
        ProtomonWideHorn,
        ProtomonNormalHorn,
        ProtomonSilverCurvedHorn,
        ProtomonTwistedWoodHorn,
        ProtomonIvoryCurlHorn,
        ProtomonSpearheadHorn,
        ProtomonDiamondHorn,
        ProtomonBitcoinDragon,
        CelestialNone,
        CelestialRegular,
        CelestialGolden
    }

    enum OriginChain {
        None,
        Ethereum,
        BNBChain,
        Polygon,
        Solana
    }

    struct Monster {
        string name;
        Background background;
        Color color;
        Glitter glitter;
        GlitterRainbow glitterRainbow;
        GlitterCrystal glitterCrystal;
        GlitterExomon glitterExomon;
        Horn horn;
        Type monsterType;
        TypeSpecial typeSpecial;
        SubCollection subCollection;
        Variant variant;
        OriginChain originChain;
        uint256 birthday;
        uint256 nfbId;
        uint256 boosterId;
        uint256 rarityPoints;
    }
}
